import React, { useState, useRef, useEffect } from "react";
import "./DarkTheme.css";
import Tooltip from './Tooltip';

const MENU = [
  {
    label: "File",
    items: [
      { label: "Open...", action: "open" },
      { label: "Select Project Folder", action: "openFolder" },
      { label: "Save", action: "save" },
      { label: "Save As...", action: "saveAs" },
      "---",
      { label: "Close Tab", action: "closeTab" },
    ],
  },
  {
    label: "Terminal",
    items: [
      { label: "Toggle Terminal", action: "toggleTerminal" },
    ],
  },
  {
    label: "AI Assistant",
    items: [
      { label: "Toggle AI Panel", action: "toggleAI" },
    ],
  },
];

function TopMenuBar({ onMenuAction }) {
  const [openMenu, setOpenMenu] = useState(null);
  const menuRefs = useRef([]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClick = (e) => {
      if (!menuRefs.current.some(ref => ref && ref.contains(e.target))) {
        setOpenMenu(null);
      }
    };
    if (openMenu !== null) {
      document.addEventListener('mousedown', handleClick);
    }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openMenu]);

  const handleMenuKeyDown = (e, idx) => {
    if (e.key === "ArrowRight") {
      setOpenMenu((open) => (open === null ? idx : (open + 1) % MENU.length));
      menuRefs.current[(idx + 1) % MENU.length]?.focus();
    } else if (e.key === "ArrowLeft") {
      setOpenMenu((open) => (open === null ? idx : (open + MENU.length - 1) % MENU.length));
      menuRefs.current[(idx + MENU.length - 1) % MENU.length]?.focus();
    } else if (e.key === "Enter" || e.key === "ArrowDown") {
      setOpenMenu(idx);
    } else if (e.key === "Escape") {
      setOpenMenu(null);
    }
  };

  const handleMenuClick = (idx) => {
    setOpenMenu(openMenu === idx ? null : idx);
  };

  const handleMenuAction = (action) => {
    setOpenMenu(null);
    onMenuAction(action);
  };

  return (
    <div className="top-menu-bar panel-shadow">
      {MENU.map((menu, idx) => (
        <div
          key={menu.label}
          className={`menu-item${openMenu === idx ? ' open' : ''}`}
          tabIndex={0}
          ref={el => menuRefs.current[idx] = el}
          onClick={() => handleMenuClick(idx)}
          onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && handleMenuClick(idx)}
          onFocus={() => {}} // no-op, menu stays open until click outside
        >
          <Tooltip content={menu.label + ' menu'}>
            <span>{menu.label}</span>
          </Tooltip>
          {openMenu === idx && (
            <div className="dropdown" role="menu">
              {menu.items.map((item, j) =>
                item === '---' ? (
                  <div className="dropdown-separator" key={j} />
                ) : (
                  <Tooltip key={item.label} content={item.label} placement="right">
                    <div
                      className="dropdown-item"
                      tabIndex={0}
                      onClick={() => handleMenuAction(item.action)}
                      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && handleMenuAction(item.action)}
                    >
                      {item.label}
                    </div>
                  </Tooltip>
                )
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default TopMenuBar;
