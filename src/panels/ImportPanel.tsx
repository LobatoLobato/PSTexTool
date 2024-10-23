import builtWithBoltUxpLogo from "../assets/built-with-bolt-uxp/Built_With_BOLT_UXP_Logo_White_V01.png";
import React from "react";
import {uxp} from "../globals";
import Hybrid from "../api/hybrid";
import {FileBrowser} from "../components/FileBrowser";
import uxptypes from "uxp";
import {notify} from "../api/photoshop";
import {truncatePath} from "../util";

export function ImportPanel() {
  const [texPath, setTexPath] = React.useState<string | undefined>();
  const [atlasPath, setAtlasPath] = React.useState<string | undefined>();

  const [importing, setImporting] = React.useState<boolean>(false);
  const [finishedImporting, setFinishedImporting] = React.useState<boolean>(false);

  const onBrowseTexFile = async (tex: uxptypes.storage.File) => {
    const path = uxp.storage.localFileSystem.getNativePath(tex);
    setTexPath(path);
  }
  const onBrowseAtlasFile = async (atlas: uxptypes.storage.File) => {
    const path = uxp.storage.localFileSystem.getNativePath(atlas);
    setAtlasPath(path);
  }
  const onImport = async () => {
    setImporting(true);
    if (!texPath) { return await notify("Please choose a tex file."); }
    try {
      await Hybrid.importTex(texPath, atlasPath);
      setFinishedImporting(true);
    } catch (err) {
      setFinishedImporting(false);
      await notify("Import failed. \n" + (err as Error).message);
    }
    setImporting(false);
  }

  return (
    <div className="panel">
      {!importing && !finishedImporting &&
          <>
              <FileBrowser
                  label={"Tex File:"}
                  path={texPath}
                  type={"file"}
                  fileTypes={["tex"]}
                  placeholder={"No tex file selected."}
                  onBrowse={onBrowseTexFile}
                  onClear={() => setTexPath(undefined)}
              />
              <FileBrowser
                  label={"Atlas File:"}
                  path={atlasPath}
                  type={"file"}
                  fileTypes={["xml"]}
                  placeholder={"No atlas file selected."}
                  onBrowse={onBrowseAtlasFile}
                  onClear={() => setAtlasPath(undefined)}
              />
              <div className="group-horizontal" style={{justifyContent: "center", marginTop: 16, paddingRight: 8}}>
                  <button onClick={onImport}>Import</button>
                  <img src={builtWithBoltUxpLogo} className="logo" alt="" style={{position: "absolute", right: 20}}/>
              </div>
          </>
      }
      {(importing) &&
          <div className="group-vertical" style={{
            display: "flex",
            width: "100%",
            height: "100%",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
              <p style={{fontSize: "24px"}}>Importing</p>
              <div className="group-vertical" style={{margin: "0 auto auto auto", alignItems: "center"}}>
                  <p style={{textDecoration: "underline"}}>{truncatePath(texPath!, 55)}</p>
                {atlasPath && <p style={{textDecoration: "underline"}}>{truncatePath(atlasPath, 55)}</p>}
              </div>
          </div>
      }
      {finishedImporting &&
          <div style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            alignItems: "center", height: "100%"
          }}
          >
              <div className="group-vertical" style={{justifyContent: "center", alignItems: "start"}}>
                  <p style={{fontSize: "20px"}}>Finished Importing File{atlasPath ? "s" : ""}:</p>
                  <p style={{textDecoration: "underline"}}>{texPath}</p>
                {atlasPath && <p style={{textDecoration: "underline"}}>{atlasPath}</p>}
              </div>
              <button onClick={() => setFinishedImporting(false)}>Ok</button>
          </div>
      }
    </div>
  )
}