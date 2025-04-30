import React from "react";
import "./DarkTheme.css";

const StatusBar = ({ line = 1, col = 1, file = "", lang = "" }) => {
  return (
    <div className="StatusBar">
      <span style={{ marginRight: 16 }}>
        {file && <>{file}</>} {lang && <>[{lang}]</>}
      </span>
      <span>Ln {line}, Col {col}</span>
      <span style={{ flex: 1 }} />
      <span style={{ color: '#7fd', fontWeight: 500, marginRight: 16 }}>Cascade IDE</span>
    </div>
  );
};

export default StatusBar;
