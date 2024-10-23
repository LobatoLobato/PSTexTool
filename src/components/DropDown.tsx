import React from "react";
import _Dropdown, {Option} from 'react-dropdown';
import "./DropDown.scss";

export interface DropdownProps {
  label: string;
  options: string[];
  defaultOption?: string;
  orientation?: "horizontal" | "vertical",
  onChange: (selected: string) => void;
  groupStyle?: React.CSSProperties
}



export function DropDown (props: DropdownProps) {
  const orientation = props.orientation ?? "horizontal";
  const onChange = (option: Option) => props.onChange(option.value)

  return <div className={`group-${orientation}`} style={props.groupStyle}>
    <p>{props.label}</p>
    <_Dropdown options={props.options} value={props.defaultOption ?? props.options[0]} onChange={onChange}/>
  </div>
}