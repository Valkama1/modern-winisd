import { Listbox } from "../../ui";
import { useProjectsContext } from "../../../context/ProjectsContext";

/**
 * Enclosure loss Q: how much energy the cabinet itself absorbs and leaks.
 *
 * Mostly damps the impedance peaks and fills in the saddle between them. Applies to
 * every enclosure type, since every one of them has a compliance.
 */
const QL_OPTIONS = [
  { value: "3", label: "Leaky / heavily stuffed (Ql = 3)" },
  { value: "5", label: "Loosely built (Ql = 5)" },
  { value: "7", label: "Well-built cabinet (Ql = 7)" },
  { value: "10", label: "Tight, braced (Ql = 10)" },
  { value: "15", label: "Very tight (Ql = 15)" },
  { value: "100", label: "Near-lossless, theoretical (Ql = 100)" },
];

export default function EnclosureLosses() {
  const { activeProject, updateActiveProject } = useProjectsContext();

  return (
    <div>
      <label className="text-xs opacity-70 block mb-1">Enclosure Losses (Ql)</label>
      <Listbox
        value={String(activeProject.ql)}
        onChange={(val) => updateActiveProject({ ql: parseFloat(val) })}
        buttonClassName="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none flex items-center justify-between gap-2 cursor-pointer text-left"
        options={QL_OPTIONS}
      />
      <p className="text-2xs opacity-55 leading-snug mt-1">
        Leakage and absorption in the cabinet. Damps the impedance peaks; alignment
        tables assume Ql = 7.
      </p>
    </div>
  );
}
