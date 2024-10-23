import React from "react";
import Hybrid, {MipmapFilter, PixelFormat, TextureType} from "../api/hybrid";
import {CheckBox, DropDown} from "../components";
import {photoshop} from "../globals";
import {notify} from "../api/photoshop";
import {Document} from "photoshop/dom/Document";
import {FileBrowser} from "../components/FileBrowser";
import uxptypes from "uxp";

// @ts-ignore
import builtWithBoltUxpLogo from "../assets/built-with-bolt-uxp/Built_With_BOLT_UXP_Logo_White_V01.png";
import {truncatePath} from "../util";

interface GridProps {
  disabled?: boolean,
  onChange: (grid: { w: number, h: number }) => void,
  onCheckGrid: (checked: boolean) => void;
}

const Grid = (props: GridProps) => {
  const [useGrid, setUseGrid] = React.useState(false);
  const [grid, setGrid] = React.useState({w: 1, h: 1});

  const onCheck = (checked: boolean) => {
    setUseGrid(checked);
    props.onCheckGrid(checked);
  }

  const onChange = (key: keyof typeof grid) => {
    return (ev: React.ChangeEvent<HTMLInputElement>) => {
      const new_grid = {...grid, [key]: parseInt(ev.target.value ? ev.target.value : "1")};
      setGrid(new_grid)
      props.onChange(new_grid);
    }
  }

  const inputDisabled = !useGrid || props.disabled;

  return (
    <div
      className="group-horizontal"
      style={{width: "unset", flex: 1, border: "2px solid #999", borderRadius: 1, padding: "0 6px 0 6px"}}
    >
      <CheckBox label={"Grid"} checked={useGrid} onClick={onCheck} labelFirst={false} disabled={props.disabled}/>
      <input type="number" width="100%" disabled={inputDisabled} value={grid.w} defaultValue={1}
             onChange={onChange("w")}/>
      <p style={{marginBottom: 4}}>x</p>
      <input type="number" width="100%" disabled={inputDisabled} value={grid.h} defaultValue={1}
             onChange={onChange("h")}/>
      <p style={{marginLeft: 0, marginBottom: 3}}>px</p>
    </div>
  )
}

export function ExportPanel() {
  const [outputPath, setoutputPath] = React.useState(window.localStorage.getItem("last_output_folder"));

  const [pixelFormat, setPixelFormat] = React.useState(Object.keys(PixelFormat)[0]);
  const [textureType, setTextureType] = React.useState(Object.keys(TextureType)[0]);
  const [mipmapFilter, setMipmapFilter] = React.useState(Object.keys(MipmapFilter)[0]);

  const [generateMipmaps, setGenerateMipmaps] = React.useState(false);
  const [preMultiplyAlpha, setpreMultiplyAlpha] = React.useState(false);

  const [exportAtlas, setExportAtlas] = React.useState(true);
  const [useGrid, setUseGrid] = React.useState(false);
  const [grid, setGrid] = React.useState({w: 1, h: 1});

  const [finishedExporting, setFinishedExporting] = React.useState(false);

  const [activeDocument, setActiveDocument] = React.useState<Document | null>(photoshop.app.activeDocument);

  React.useEffect(() => {
    const events = ["open", "close", "select", "modalJavaScriptScopeExit"];
    const setDocument = () => setActiveDocument(photoshop.app.activeDocument);
    photoshop.action.addNotificationListener(events, setDocument)?.catch(console.log);
    return () => {
      photoshop.action.removeNotificationListener(events, setDocument)?.catch(console.log);
    }
  }, []);

  const onBrowseFolder = async (folder: uxptypes.storage.Folder) => {
    window.localStorage.setItem("last_output_folder", folder.nativePath);
    setoutputPath(folder.nativePath);
  }

  const onExport = async () => {
    if (!outputPath) { return await notify("Please choose an output folder."); }

    const doc = photoshop.app.activeDocument;

    try {
      await Hybrid.exportTex(doc, outputPath, {
        pixelFormat: PixelFormat[pixelFormat],
        textureType: TextureType[textureType],
        mipmapFilter: MipmapFilter[mipmapFilter],
        generateMipmaps,
        preMultiplyAlpha,
        exportAtlas,
        grid: useGrid ? grid : undefined
      });

      setFinishedExporting(true);
    } catch (err) {
      await notify("Export failed. \n" + (err as Error).message);
    }
  }

  const texFullPath = activeDocument ? outputPath + "\\" + activeDocument.name.replace(".psd", ".tex") : "";
  const atlasFullPath = activeDocument ? outputPath + "\\" + activeDocument.name.replace(".psd", ".xml") : "";

  return (
    <div className="panel">
      <div style={finishedExporting ? {visibility: "hidden"} : undefined}>
        <FileBrowser
          label={"Output Folder:"}
          path={outputPath}
          type={"folder"}
          placeholder={"No output path selected."}
          onBrowse={onBrowseFolder}
        />

        <div className="group-vertical">
          <DropDown label="Pixel Format:" options={Object.keys(PixelFormat)} onChange={setPixelFormat}/>
          <DropDown label="Texture Type:" options={Object.keys(TextureType)} onChange={setTextureType}/>
          <DropDown label="Mipmap Filter:" options={Object.keys(MipmapFilter)} onChange={setMipmapFilter}/>
        </div>

        <CheckBox label="Generate Mipmaps" checked={generateMipmaps} onClick={setGenerateMipmaps}/>
        <CheckBox label="Pre-Multiply Alpha" checked={preMultiplyAlpha} onClick={setpreMultiplyAlpha}/>

        <div className="group-horizontal">
          <CheckBox label="Export Atlas" checked={exportAtlas} onClick={setExportAtlas}/>
          <Grid onChange={setGrid} onCheckGrid={setUseGrid}/>
        </div>

        <div className="group-horizontal" style={{justifyContent: "center", marginTop: 16, paddingRight: 8}}>
          <button disabled={!activeDocument} onClick={onExport}>
            Export
          </button>
          <img src={builtWithBoltUxpLogo} className="logo" alt="" style={{position: "absolute", right: 20}}/>
        </div>
      </div>
      {finishedExporting &&
          <div style={{
            display: "flex",
            position: "absolute",
            flexDirection: "column",
            justifySelf: "start",
            justifyContent: "space-between",
            alignItems: "center",
            height: "90%",
            width: "91%",
            zIndex: 999
          }}
          >
              <div className="group-vertical" style={{justifyContent: "center", alignItems: "start"}}>
                  <p style={{fontSize: "20px"}}>Finished Exporting Files:</p>
                  <p style={{textDecoration: "underline"}}>{truncatePath(texFullPath, 55)}</p>
                  <p style={{textDecoration: "underline"}}>{truncatePath(atlasFullPath, 55)}</p>
              </div>
              <button onClick={() => setFinishedExporting(false)}>Ok</button>
          </div>
      }
    </div>
  )
}