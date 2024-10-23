import {Document} from "photoshop/dom/Document";
import {photoshop} from "../globals";
import {Bounds} from "photoshop/dom/types/SharedTypes";
import {notify} from "./photoshop";
import {truncatePath} from "../util";
import {Layers} from "photoshop/dom/collections/Layers";

const _PixelFormat: Record<string, number> = {
  'DXT5': 2,
  'DXT3': 1,
  'DXT1': 0,
  'ARGB': 4,
};
const PixelFormat: typeof _PixelFormat & Record<string, number> = _PixelFormat;

const _TextureType: Record<string, number> = {
  '1D': 1,
  '2D': 2,
  '3D': 3,
  'Cube Mapped': 4
};
const TextureType: typeof _TextureType & Record<string, number> = _TextureType;

const _MipmapFilter: Record<string, number> = {
  'Default': 2,
  'Low': 2,
  'High': 5,
  'Nearest Neighbor': 1,
  'Bilinear': 2,
  'Bicubic': 3,
  'High Quality Bilinear': 4,
  'High Quality Bicubic': 5
}
const MipmapFilter: typeof _MipmapFilter & Record<string, number> = _MipmapFilter;

interface ImageToTexConversionOptions {
  pixelFormat?: number;
  textureType?: number;
  mipmapFilter?: number;
  generateMipmaps?: boolean;
  preMultiplyAlpha?: boolean;
  exportAtlas?: boolean;
  grid?: { w: number; h: number };
}

interface ImageData {
  size: { w: number, h: number };
  channels: number;
  data: ArrayBufferLike;
}

interface ExtendedDocument {
  name: string,
  width: number,
  height: number,
  layers: Layers,
  grid?: { w: number, h: number };
}

interface HybridModule {
  exportTex: (doc: ExtendedDocument, outputFolder: string, data: ImageData, options: ImageToTexConversionOptions) => string;
  exportAtlas: (doc: ExtendedDocument, outputPath: string) => string;
  importTex: (texPath: string, atlasPath?: string) => {
    name: string,
    w: number,
    h: number,
    buffer?: Uint8Array,
    buffers?: {
      name: string, buffer: Uint8Array,
      w: number, h: number,
      left: number, right: number,
      bottom: number, top: number
    }[]
  };
}

const hybridModule = require("bolt-uxp-hybrid.uxpaddon") as Promise<HybridModule>;

const exportAtlasTask = async (doc: Document, outputFolder: string, grid?: { w: number, h: number }) => {
  try {
    const extendedDoc: ExtendedDocument = doc;
    extendedDoc.grid = grid;
    return (await hybridModule).exportAtlas(extendedDoc, outputFolder);
  } catch (err) {
    throw new Error("Export Atlas command failed. \n" + (err as Error).message);
  }
}
const exportTexTask = async (doc: Document, outputFolder: string, options: ImageToTexConversionOptions) => {
  try {
    const psImageData = (await photoshop.imaging.getPixels({documentID: doc.id})).imageData;
    const imageData = {
      size: {w: doc.width, h: doc.height},
      channels: psImageData.components,
      data: (await psImageData.getData({})).buffer,
    };

    let exportTexResult = (await hybridModule).exportTex(doc, outputFolder, imageData, options);

    await psImageData.dispose();

    return exportTexResult;
  } catch (err) {
    throw new Error("Export Tex command failed. \n" + (err as Error).message);
  }
};

const exportTex = async (doc: Document, outputFolder: string, options: ImageToTexConversionOptions) => {
  const texFilePath = truncatePath(`${outputFolder}\\${doc.name.replace(".psd", ".tex")}`, 50);
  const atlasFilePath = truncatePath(`${outputFolder}\\${doc.name.replace(".psd", ".xml")}`, 50);

  return await photoshop.core.executeAsModal(async (ctx) => {
    ctx.reportProgress({commandName: `Exporting ${texFilePath}...`, value: 0.001});
    await exportTexTask(doc, outputFolder, options);

    if (options.exportAtlas) {
      ctx.reportProgress({commandName: `Exporting ${atlasFilePath}...`, value: 0.5});
      await exportAtlasTask(doc, outputFolder, options.grid ?? undefined);
    }
    ctx.reportProgress({commandName: "Done.", value: 1});
    await new Promise((resolve) => window.setTimeout(resolve, 500));
  }, {commandName: "exportTex"});

};

const importTex = async (texPath: string, atlasPath?: string) => {
  async function createLayer(doc: Document, name: string, width: number, height: number, buffer: Uint8Array, bounds?: Bounds) {
    const layer = await doc.createPixelLayer({name});
    if (!layer) { throw new Error("Could not create layer: " + name);}
    const imgdata = await photoshop.imaging.createImageDataFromBuffer(buffer, {
      height, width,
      components: 4,
      colorProfile: "sRGB IEC61966-2.1",
      colorSpace: "RGB"
    });

    await photoshop.imaging.putPixels({
      documentID: doc.id,
      layerID: layer.id,
      imageData: imgdata,
      targetBounds: bounds ?? {left: 0, right: width, bottom: height, top: 0},
      replace: true
    });
    return await imgdata.dispose();
  }


  await photoshop.core.executeAsModal(async (ctx) => {
    ctx.reportProgress({commandName: `Reading file${atlasPath ? "s" : ""}`, value: 0.001});
    const imageData = (await hybridModule).importTex(texPath, atlasPath);
    const progressStep = imageData.buffer ? 1 / 4 : 1 / (3 + imageData.buffers!.length);
    let progress = progressStep;

    ctx.reportProgress({commandName: `Creating new document ${imageData.name}...`, value: progress});
    const new_doc = await photoshop.app.createDocument({
      name: imageData.name,
      width: imageData.w,
      height: imageData.h,
      profile: "RGBA",
    });
    if (!new_doc) { return await notify("Could not create docucment: " + imageData.name); }

    const bglayer = new_doc.layers[0];
    if (imageData.buffer) {
      const name = imageData.name.replace(".psd", "");
      ctx.reportProgress({commandName: `Creating layer ${name}...`, value: progress += progressStep});
      await createLayer(new_doc, name, imageData.w, imageData.h, imageData.buffer);
    } else {
      for (const {name, buffer, w, h, left, right, bottom, top} of imageData.buffers!) {
        ctx.reportProgress({commandName: `Creating layer ${name}...`, value: progress += progressStep});
        await createLayer(new_doc, name, w, h, buffer, {left, right, bottom, top});
      }
    }

    ctx.reportProgress({commandName: "Finishing up", value: progress + progressStep});

    bglayer.delete();
    ctx.reportProgress({commandName: "Done", value: 1});
  }, {commandName: "importTex"});
}

export {
  PixelFormat,
  TextureType,
  MipmapFilter,
}

export default {
  exportTex,
  // exportAtlas,
  importTex
}