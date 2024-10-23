import React from "react";
import type uxptypes from "uxp";
import {uxp} from "../globals";
import {truncatePath} from "../util";
import "./FileBrowser.scss";

type FileBrowserProps = {
  label: string;
  path?: string | null;
  type: "folder" | "file";
  placeholder: string;
  onClear?: () => void
} & (
  {
    type: "folder",
    onBrowse: (folder: uxptypes.storage.Folder) => void
  }
  |
  {
    type: "file",
    allowMultiple: true,
    fileTypes: string[],
    onBrowse: (files: uxptypes.storage.File[]) => void
  }
  |
  {
    type: "file",
    allowMultiple?: false,
    fileTypes: string[],
    onBrowse: (file: uxptypes.storage.File) => void
  }
  )

export function FileBrowser(props: FileBrowserProps) {
  const onBrowse = async () => {
    if (props.type === "folder") {
      const folder = await uxp.storage.localFileSystem.getFolder();
      if (folder) { props.onBrowse(folder); }
    } else if (props.type === "file") {
      const tex = await uxp.storage.localFileSystem.getFileForOpening({
        types: props.fileTypes,
        allowMultiple: props.allowMultiple,
      });

      if (tex && props.allowMultiple && Array.isArray(tex)) {
        props.onBrowse(tex);
      } else if (tex && !props.allowMultiple && !Array.isArray(tex)) {
        props.onBrowse(tex);
      }
    }
  }

  return (
    <div className="group-vertical file-browser">
      <div className="group-horizontal" style={{justifyContent: "space-between"}}>
        <p>{props.label}</p>
        <p style={{marginLeft: 8, textDecoration: "underline"}}>
          {truncatePath(props.path ?? props.placeholder, 28)}
        </p>
        <div className="group-horizontal" style={{width: "min-content"}}>
          {props.onClear && <div className="button" onClick={props.onClear}>X</div>}
          <div className="button" onClick={onBrowse}>Browse...</div>
        </div>
      </div>
    </div>
  )
}