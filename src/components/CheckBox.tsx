import React from "react";

export interface CheckBoxProps {
  label: string;
  checked: boolean;
  defaultchecked?: boolean;
  orientation?: "horizontal" | "vertical",
  labelFirst?: boolean;
  onClick: (checked: boolean) => void
  disabled?: boolean;
  groupStyle?: React.CSSProperties
}

export function CheckBox (props: CheckBoxProps) {
  const orientation = props.orientation ?? "horizontal";
  const label = <p style={{marginLeft: 0, whiteSpace: "nowrap"}}>{props.label}</p>;

  const onClick = (ev: React.MouseEvent<HTMLInputElement>) => props.onClick(ev.currentTarget.checked);
  console.log(props.checked);
  return <div className={`group-${orientation}`} style={props.groupStyle ?? {width: "max-content"}}>
    {props.labelFirst && label}
    <input
      type="checkbox"
      checked={props.checked}
      defaultChecked={props.checked}
      disabled={props.disabled}
      onClick={onClick}
      style={props.labelFirst ? {marginLeft: 0} : {}}
    />
    {!props.labelFirst && label}
  </div>
}