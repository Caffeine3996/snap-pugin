import React from "react";
import { Checkbox, Tooltip } from "antd";
import { PlayCircleOutlined } from "@ant-design/icons";
import styles from "../index.module.css";

export default function MediaGrid({ dataList, selectedIds, onToggleSelect, onPreview }: any) {
  if (!dataList.length) return null;
  return (
    <div className={styles.scrollArea}>
      <div className={styles.gridContainer}>
        {dataList.map((item: any) => (
          <div key={item.back_key_id} className={styles.card}>
            <Checkbox
              className={styles.checkbox}
              checked={selectedIds.has(item.f_name)}
              onChange={(e) => onToggleSelect(item.f_name, e.target.checked)}
            />
            <img src={item.f_thumbnail} alt={item.f_name} className={styles.img} />
            <PlayCircleOutlined className={styles.playIcon} onClick={() => onPreview(item)} />
            <div className={styles.nameInfo}>
              <Tooltip title={item.f_name}>
                <div className={styles.name}>{item.f_name}</div>
              </Tooltip>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
