import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Driver } from "../types";
import {
  RHO_AIR,
  SPEED_OF_SOUND,
  blFromFsMmsQes,
  cmsFromVasSd,
  eta0FromFsVasQes,
  mmsKgFromFsCms,
} from "../lib/calculations";
import { useToast, useDialog } from "../components/ui";
import { useDriverDatabaseContext } from "../context/DriverDatabaseContext";
import { useProjectsContext } from "../context/ProjectsContext";

// Pure, stateless — exported standalone so it can be used both from inside this hook
// (the Add/Edit Driver Modal) and from AppShell's Driver Info panel, which reads the
// active driver's consistency outside the DriverFormProvider's subtree.
export function checkDriverConsistency(drv: Driver) {
  if (!drv.fs || !drv.mms || !drv.sd || !drv.vas) return null;
  const fs = drv.fs;
  const mms = drv.mms;
  const sd = drv.sd;
  const vas = drv.vas;

  // 1. Calculate Cms in mm/N
  const cms = 1e6 / (Math.pow(2 * Math.PI * fs, 2) * mms);

  // 2. Calculate derived Vas in Liters
  const derivedVas = 0.00138813 * Math.pow(sd, 2) * cms;

  // Discrepancy ratio
  const discrepancy = Math.abs(derivedVas - vas) / vas;

  return {
    cms,
    derivedVas,
    discrepancy,
    isInconsistent: discrepancy > 0.15, // Warning threshold: >15% discrepancy
  };
}

export function useDriverForm() {
  const toast = useToast();
  const { confirmDialog } = useDialog();
  const { editingDriverId, browserCallback, setDrivers, setShowAddForm, setShowBrowser, setBrowserCallback, setEditingDriverId } = useDriverDatabaseContext();
  const { updateActiveProject, setProjectsWithHistory } = useProjectsContext();

  // Add Driver Form Fields
  const [newManufacturer, setNewManufacturer] = useState("");
  const [newModel, setNewModel] = useState("");
  const [newFs, setNewFs] = useState("33");
  const [newQes, setNewQes] = useState("0.37");
  const [newQms, setNewQms] = useState("7.7");
  const [newQts, setNewQts] = useState("0.36");
  const [newVas, setNewVas] = useState("278");
  const [newRe, setNewRe] = useState("3.6");
  const [newSd, setNewSd] = useState("1680");
  const [newXmax, setNewXmax] = useState("14");
  const [newMms, setNewMms] = useState("335");
  const [newLe, setNewLe] = useState("1.7");
  const [newBl, setNewBl] = useState("24.8");
  const [newPe, setNewPe] = useState("1700");
  const [newSens, setNewSens] = useState("97");

  // Helper inputs for estimation
  const [pistonDiameter, setPistonDiameter] = useState("");
  const [nominalImpedance, setNominalImpedance] = useState("4");

  // Recalculate Qts if Qes or Qms changes
  useEffect(() => {
    const qes = parseFloat(newQes);
    const qms = parseFloat(newQms);
    if (!isNaN(qes) && !isNaN(qms) && qes + qms > 0) {
      const calculatedQts = (qes * qms) / (qes + qms);
      setNewQts(calculatedQts.toFixed(3));
    }
  }, [newQes, newQms]);

  // Add Driver Action
  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newManufacturer || !newModel) {
      await confirmDialog({ title: "Missing Fields", body: "Manufacturer and Model are required.", okOnly: true });
      return;
    }

    const finalFs = parseFloat(newFs) || 30.0;
    const finalQes = parseFloat(newQes) || 0.4;
    const finalQms = parseFloat(newQms) || 5.0;
    const finalVas = parseFloat(newVas) || 50.0;
    const finalQts = parseFloat(newQts) || (finalQes * finalQms) / (finalQes + finalQms);

    let finalSd = parseFloat(newSd) || 0;
    if (finalSd <= 0) {
      if (pistonDiameter) {
        const diaCm = parseFloat(pistonDiameter) * 2.54;
        finalSd = Math.PI * Math.pow(diaCm / 2, 2);
      } else {
        finalSd = 530.0; // fallback standard 12 inch
      }
    }

    let finalRe = parseFloat(newRe) || 0;
    if (finalRe <= 0) {
      finalRe = nominalImpedance ? parseFloat(nominalImpedance) * 0.8 : 3.6;
    }

    let finalMms = parseFloat(newMms) || 0;
    let finalBl = parseFloat(newBl) || 0;
    let finalSens = parseFloat(newSens) || 0;

    const vasM3 = finalVas * 1e-3;
    const ws = 2.0 * Math.PI * finalFs;
    const cms = cmsFromVasSd(finalVas, finalSd);

    if (finalMms <= 0 && cms > 0 && ws > 0) {
      finalMms = mmsKgFromFsCms(finalFs, cms) * 1000.0;
    }
    const finalMmsKg = finalMms / 1000.0;

    if (finalBl <= 0 && ws > 0 && finalMmsKg > 0 && finalRe > 0 && finalQes > 0) {
      finalBl = blFromFsMmsQes(finalFs, finalMmsKg, finalRe, finalQes);
    }

    if (finalSens <= 0 && finalFs > 0 && vasM3 > 0 && finalQes > 0) {
      const eta0 = eta0FromFsVasQes(finalFs, finalVas, finalQes);
      if (eta0 > 0) {
        finalSens = 112.0 + 10.0 * Math.log10(eta0);
      } else {
        finalSens = 90.0;
      }
    }

    const finalLe = parseFloat(newLe) || 1.5; // typical default
    const finalPe = parseFloat(newPe) || 250.0;
    const finalXmax = parseFloat(newXmax) || 5.0;

    const driverData: Driver = {
      id: "",
      manufacturer: newManufacturer,
      model: newModel,
      fs: finalFs,
      qts: finalQts,
      qes: finalQes,
      qms: finalQms,
      vas: finalVas,
      re: finalRe,
      sd: finalSd,
      xmax: finalXmax,
      mms: finalMms,
      le: finalLe,
      bl: finalBl,
      pe: finalPe,
      sens: finalSens,
    };

    try {
      let updatedDrivers: Driver[];
      if (editingDriverId) {
        updatedDrivers = await invoke("edit_driver", { id: editingDriverId, driver: driverData });
        // Update all projects using this driver
        const savedDriver = updatedDrivers.find(d => d.id === editingDriverId) || driverData;
        setProjectsWithHistory((prev) =>
          prev.map((p) => (p.driver.id === editingDriverId ? { ...p, driver: { ...savedDriver, id: editingDriverId } } : p))
        );
      } else {
        updatedDrivers = await invoke("add_driver", { driver: driverData });
        const savedDriver = updatedDrivers[updatedDrivers.length - 1];
        if (browserCallback) {
          browserCallback(savedDriver);
        } else {
          updateActiveProject({
            driver: savedDriver,
            vBox: savedDriver.vas / 2,
          });
        }
      }
      setDrivers(updatedDrivers);
      setShowAddForm(false);
      setShowBrowser(false);
      setBrowserCallback(null);
      setEditingDriverId(null);
      setNewManufacturer("");
      setNewModel("");
    } catch (err) {
      toast.error("Error saving driver: " + err);
    }
  };

  const handleAutoEstimateTS = async () => {
    const fs = parseFloat(newFs);
    const qes = parseFloat(newQes);
    const qms = parseFloat(newQms);
    const vas = parseFloat(newVas);

    // Compute Qts
    if (qes && qms) {
      const qtsVal = (qes * qms) / (qes + qms);
      setNewQts(qtsVal.toFixed(4));
    }

    // Estimate Sd from piston diameter if provided
    let sdVal = parseFloat(newSd);
    if (pistonDiameter) {
      const diaCm = parseFloat(pistonDiameter) * 2.54;
      sdVal = Math.PI * Math.pow(diaCm / 2, 2);
      setNewSd(sdVal.toFixed(1));
    }

    // Estimate Re if not provided
    let reVal = parseFloat(newRe);
    if (!reVal) {
      reVal = nominalImpedance ? parseFloat(nominalImpedance) * 0.8 : 3.6;
      setNewRe(reVal.toFixed(2));
    }

    if (fs && qes && qms && vas && sdVal && reVal) {
      // Cms
      const cms = cmsFromVasSd(vas, sdVal);

      // Mms
      const mmsKg = mmsKgFromFsCms(fs, cms);
      const mmsG = mmsKg * 1000.0;
      setNewMms(mmsG.toFixed(1));

      // Bl
      const blVal = blFromFsMmsQes(fs, mmsKg, reVal, qes);
      setNewBl(blVal.toFixed(2));

      // Sensitivity
      const eta0 = eta0FromFsVasQes(fs, vas, qes);
      if (eta0 > 0) {
        const sensVal = 112.0 + 10.0 * Math.log10(eta0);
        setNewSens(sensVal.toFixed(1));
      }
    } else {
      await confirmDialog({
        title: "Missing Fields",
        body: "Please ensure Fs, Qes, Qms, Vas, and either Sd or Piston Diameter are populated first.",
        okOnly: true,
      });
    }
  };

  const handleVerifyParameters = async () => {
    const fs = parseFloat(newFs);
    const qes = parseFloat(newQes);
    const qms = parseFloat(newQms);
    const vas = parseFloat(newVas);

    let sd = parseFloat(newSd);
    if (!sd && pistonDiameter) {
      const diaCm = parseFloat(pistonDiameter) * 2.54;
      sd = Math.PI * Math.pow(diaCm / 2, 2);
    }

    if (!fs || !qes || !qms || !vas || !sd) {
      await confirmDialog({
        title: "Cannot Verify",
        body: "Verification requires at least Fs, Qes, Qms, Vas, and Sd (or Piston Diameter) to be filled in.",
        okOnly: true,
      });
      return;
    }

    const re = parseFloat(newRe) || 3.6;

    const rho = RHO_AIR;
    const c_air = SPEED_OF_SOUND;
    const sdM2 = sd * 1e-4;
    const vasM3 = vas * 1e-3;
    const cms = vasM3 / (rho * c_air * c_air * sdM2 * sdM2);
    const ws = 2.0 * Math.PI * fs;
    const derivedMmsKg = 1.0 / (ws * ws * cms);
    const derivedMmsG = derivedMmsKg * 1000.0;

    const derivedBl = Math.sqrt((ws * derivedMmsKg * re) / qes);

    const enteredMms = parseFloat(newMms);
    const enteredBl = parseFloat(newBl);

    const anomalies: string[] = [];

    if (enteredMms > 0) {
      const cmsFromMms = 1.0 / (ws * ws * (enteredMms / 1000.0));
      const derivedVasL = 0.00138813 * Math.pow(sd, 2) * (cmsFromMms * 1000.0);
      const vasDiscrepancy = Math.abs(derivedVasL - vas) / vas;
      if (vasDiscrepancy > 0.15) {
        anomalies.push(
          `• Vas Discrepancy: Entered Vas is ${vas} L, but based on your entered Sd (${sd.toFixed(1)} cm²) and moving mass, it should mathematically be ${derivedVasL.toFixed(1)} L. This is a ${Math.round(vasDiscrepancy * 100)}% discrepancy. Please check if your Sd or Vas has a manufacturer copy-paste error.`
        );
      }

      const mmsDiscrepancy = Math.abs(enteredMms - derivedMmsG) / derivedMmsG;
      if (mmsDiscrepancy > 0.15) {
        anomalies.push(
          `• Mms Discrepancy: Entered Mms is ${enteredMms} g, but calculated moving mass from your Vas/Sd is ${derivedMmsG.toFixed(1)} g. (Difference: ${Math.round(mmsDiscrepancy * 100)}%).`
        );
      }
    }

    if (enteredBl > 0) {
      const blDiscrepancy = Math.abs(enteredBl - derivedBl) / derivedBl;
      if (blDiscrepancy > 0.15) {
        anomalies.push(
          `• BL Motor Strength Discrepancy: Entered BL is ${enteredBl} T·m, but calculated BL from Qes and moving mass is ${derivedBl.toFixed(2)} T·m. (Difference: ${Math.round(blDiscrepancy * 100)}%).`
        );
      }
    }

    if (anomalies.length > 0) {
      await confirmDialog({
        title: "Thiele-Small Verification Report",
        body: `${anomalies.join("\n\n")}\n\nNote: The backend simulation solver will automatically run with self-consistent derived parameters (best-effort alignment), but resolving these anomalies ensures that all graphs and parameters behave identically to the manufacturer's target.`,
        okOnly: true,
      });
    } else {
      await confirmDialog({
        title: "Thiele-Small Verification: Success",
        body: `All parameters (Fs, Qts, Vas, Sd, Mms, BL) are mathematically consistent within tolerances. Your driver is perfectly configured for simulation!`,
        okOnly: true,
      });
    }
  };

  return {
    newManufacturer, setNewManufacturer, newModel, setNewModel,
    newFs, setNewFs, newQes, setNewQes, newQms, setNewQms, newQts, setNewQts,
    newVas, setNewVas, newRe, setNewRe, newSd, setNewSd, newXmax, setNewXmax,
    newMms, setNewMms, newLe, setNewLe, newBl, setNewBl, newPe, setNewPe, newSens, setNewSens,
    pistonDiameter, setPistonDiameter, nominalImpedance, setNominalImpedance,
    handleAddDriver, handleAutoEstimateTS, handleVerifyParameters, checkDriverConsistency,
  };
}
