declare module "*.png";
declare module "*.gif";
declare module "*.jpg";
declare module "*.svg";
import uxptypes from "uxp";

export const uxp = require("uxp") as typeof uxptypes & {
  storage: typeof uxptypes.storage & {
    localFileSystem: {
      getFolder(options?: { initialDomain?: symbol | undefined }): Promise<uxptypes.storage.Folder | null>,
      getFileForOpening(options?: {
                          initialDomain?: symbol | undefined,
                          types?: string[],
                          initialLocation?: uxptypes.storage.Folder | uxptypes.storage.File,
                          allowMultiple?: boolean
                        }
      ): Promise<uxptypes.storage.File | Array<uxptypes.storage.File> | null>;
      getNativePath(entry: uxptypes.storage.Entry | uxptypes.storage.File | uxptypes.storage.Folder): string;
    }
  }
};

const hostName = uxp.host.name;

export const photoshop = (
  hostName === "Photoshop" ? require("photoshop") : {}
) as typeof import("photoshop");

export const indesign = (
  hostName === "InDesign" ? require("indesign") : {}
) as any;
export const premierepro = (
  hostName === "PremierePro" ? require("premierepro") : {}
) as any;
export const illustrator = (
  hostName === "Illustrator" ? require("illustrator") : {}
) as any;
