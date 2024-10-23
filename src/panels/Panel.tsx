import React from "react";
import {Panel as _Panel} from "ruxp";


export interface PanelProps extends React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  id: string;
  render?: React.ComponentType;
  gripper?: boolean;
}

export function Panel(props: PanelProps) {
  const div_props = {...props, id: undefined, render: undefined, gripper: undefined};
  return (
    <_Panel id={props.id} render={props.render} gripper={props.gripper}>
      <div {...div_props}>{props.children}</div>
    </_Panel>
  )
}