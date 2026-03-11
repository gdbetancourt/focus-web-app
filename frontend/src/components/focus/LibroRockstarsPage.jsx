import React from "react";

export default function LibroRockstarsPage() {
  return (
    <div style={{
      width: "100%",
      height: "calc(100vh - 56px)",
      display: "flex",
      flexDirection: "column"
    }}>
      <iframe
        src="https://focus1-antigravity-production.up.railway.app/libro/"
        style={{
          flex: 1,
          width: "100%",
          border: "none",
          display: "block"
        }}
        title="Rockstars del Storytelling"
      />
    </div>
  );
}
