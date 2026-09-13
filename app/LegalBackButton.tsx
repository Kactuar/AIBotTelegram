"use client";

export default function LegalBackButton({ english }: { english: boolean }) {
  return <button type="button" onClick={() => history.back()} style={{ marginBottom: 16, padding: "10px 16px", border: 0, borderRadius: 10, background: "#111", color: "#fff", cursor: "pointer" }}>← {english ? "Back" : "Назад"}</button>;
}
