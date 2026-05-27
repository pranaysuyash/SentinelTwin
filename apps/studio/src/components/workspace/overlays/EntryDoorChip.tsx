interface EntryDoorChipProps {
  label?: string;
}

export function EntryDoorChip({ label = "Entry" }: EntryDoorChipProps) {
  return (
    <div
      style={{
        background: "rgba(76,29,149,0.75)",
        border: "1px solid #a78bfa",
        borderRadius: 6,
        padding: "3px 8px",
        fontSize: 9,
        fontWeight: 700,
        color: "#c4b5fd",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </div>
  );
}
