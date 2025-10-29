// HeaderBar.tsx
import React from "react";
import { Select, Input, Button } from "antd";
import { SettingOutlined, CloseOutlined } from "@ant-design/icons";
import styles from "../index.module.css";

export default function HeaderBar({
  fieldValues,
  selectedValue,
  keyword,
  selectedCount,
  onAccountChange,
  onKeywordChange,
  onSettingsClick,
  onClearSelected,
}: any) {
  return (
    <div
      className={styles.selectWrapper}
      style={{ display: "flex", alignItems: "center", gap: 8, position: "relative" }}
    >
      <Select
        style={{ width: 220 }}
        options={fieldValues}
        value={selectedValue}
        placeholder="请选择账户"
        onChange={onAccountChange}
      />
      <Input
        style={{ width: 200 }}
        placeholder="搜索关键字"
        value={keyword}
        onChange={(e) => onKeywordChange(e.target.value)}
      />

      <SettingOutlined
        style={{ fontSize: 16, cursor: "pointer",position:'absolute',top:'6px',right:'6px' }}
        onClick={onSettingsClick}
      />

      {selectedCount > 0 && (
        <Button type="primary" style={{ display: "flex", alignItems: "center", gap: 4 }}>
          已选 {selectedCount}
          <CloseOutlined onClick={onClearSelected} />
        </Button>
      )}
    </div>
  );
}
