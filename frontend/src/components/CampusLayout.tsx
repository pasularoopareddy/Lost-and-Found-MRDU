export type CampusPlace = {
  name: string;
  latitude: number;
  longitude: number;
  kind?: "ground" | "facility" | "block";
};

type CampusLayoutProps = {
  onSelect: (place: CampusPlace) => void;
};

const places: CampusPlace[] = [
  { name: "Block 1 · Administrative Block", latitude: 17.54385, longitude: 78.57095 },
  { name: "Block 2 · Knowledge Centre", latitude: 17.54386, longitude: 78.57125 },
  { name: "Block 3 · ECE / EEE Block", latitude: 17.54395, longitude: 78.57155 },
  { name: "Block 4 · Mech Block", latitude: 17.54398, longitude: 78.57182 },
  { name: "Block 5 · Emerging Block", latitude: 17.5440, longitude: 78.57208 },
  { name: "Block 6 · CSE Block", latitude: 17.54403, longitude: 78.57232 },
  { name: "Block 7 · Pharma Block", latitude: 17.54403, longitude: 78.57255 },
  { name: "Block 8 · Pharma", latitude: 17.54403, longitude: 78.57275 },
  { name: "Block 9 · Sports Block", latitude: 17.54445, longitude: 78.57302 },
  { name: "Block 10 · IT Block", latitude: 17.54445, longitude: 78.57265 },
  { name: "Block 11 · New Block", latitude: 17.5449, longitude: 78.5718 },
  { name: "Block 12 · Library", latitude: 17.54488, longitude: 78.57125 },
  { name: "Block 13 · First Year Block", latitude: 17.54452, longitude: 78.57128 },
  { name: "Canteen", latitude: 17.54495, longitude: 78.57212, kind: "facility" },
  { name: "Football Ground", latitude: 17.54458, longitude: 78.5719, kind: "ground" },
  { name: "Cricket Ground", latitude: 17.54512, longitude: 78.57272, kind: "ground" },
];

export default function CampusLayout({ onSelect }: CampusLayoutProps) {
  return (
    <section className="campus-layout-section" aria-labelledby="campus-layout-title">
      <div className="layout-heading">
        <div>
          <p className="eyebrow">CAMPUS NAVIGATOR</p>
          <h2 id="campus-layout-title">Not sure of the exact location?</h2>
          <p>Choose a familiar campus place. We will add it to your report for you.</p>
        </div>
        <span className="layout-note">Click a location to select it</span>
      </div>
      <div className="layout-map" role="group" aria-label="MRDU campus layout">
        <div className="layout-road road-top" /><div className="layout-road road-bottom" />
        <span className="main-gate">MAIN GATE →</span>
        {places.map((place) => (
          <button key={place.name} className={`campus-place ${place.kind ?? "block"}`} onClick={() => onSelect(place)}>
            {place.name.replace(/ · .*/, "")}
          </button>
        ))}
      </div>
      <div className="layout-legend">Block 1: Administrative · Block 2: Knowledge Centre · Block 3: ECE/EEE · Block 4: Mech · Block 5: Emerging · Block 6: CSE · Block 10: IT · Block 12: Library</div>
    </section>
  );
}
