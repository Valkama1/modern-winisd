import SplOutputSection from "./signal/SplOutputSection";
import EqFilterSection from "./signal/EqFilterSection";
import PassiveCrossoverSection from "./signal/PassiveCrossoverSection";
import CabinGainSection from "./signal/CabinGainSection";
import RoomSimulationSection from "./signal/RoomSimulationSection";

/**
 * Everything applied on top of the enclosure's own response: drive level, EQ, a
 * passive network, and the room or cabin it plays into.
 *
 * Each section reads what it needs from context, so adding one is a file and a line.
 */
export default function SignalTab() {
  return (
    <div className="flex flex-col gap-4">
      <SplOutputSection />
      <EqFilterSection />
      <PassiveCrossoverSection />
      <CabinGainSection />
      <RoomSimulationSection />
    </div>
  );
}
