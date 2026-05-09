import { toPng, toJpeg, toSvg } from 'html-to-image';
import jsPDF from 'jspdf';
import { getNodesBounds, getViewportForBounds, Node } from 'reactflow';
import { useZampFlowStore } from '../store/useZampFlowStore';

const PADDING = 64;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;

function getActiveNodes(): Node[] {
  const proc = useZampFlowStore.getState().activeProcess();
  if (!proc) return [];
  // Ensure each node has width/height for getNodesBounds. Source order:
  // measured (n.width/n.height) \u2192 style.width/style.height \u2192 sensible default.
  return proc.nodes.map(n => {
    const styleWidth = (n.style?.width as number | undefined);
    const styleHeight = (n.style?.height as number | undefined);
    const width = (n.width as number | undefined) ?? styleWidth ?? 160;
    const height = (n.height as number | undefined) ?? styleHeight ?? 60;
    return { ...n, width, height } as Node;
  });
}

function getViewportEl(): HTMLElement | null {
  return document.querySelector('.react-flow__viewport') as HTMLElement | null;
}

function buildOptions(imageWidth: number, imageHeight: number, viewport: { x: number; y: number; zoom: number }) {
  return {
    backgroundColor: '#ffffff',
    width: imageWidth,
    height: imageHeight,
    style: {
      width: `${imageWidth}px`,
      height: `${imageHeight}px`,
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
      transformOrigin: '0 0',
    },
    pixelRatio: 2,
  } as const;
}

function download(filename: string, dataUrl: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

interface CaptureCtx {
  viewportEl: HTMLElement;
  imageWidth: number;
  imageHeight: number;
  viewport: { x: number; y: number; zoom: number };
}

function prepareCapture(): CaptureCtx {
  const nodes = getActiveNodes();
  if (nodes.length === 0) {
    throw new Error('Nothing to export \u2014 add at least one node first.');
  }
  const viewportEl = getViewportEl();
  if (!viewportEl) {
    throw new Error('Canvas not ready.');
  }
  const bounds = getNodesBounds(nodes);
  const imageWidth = Math.max(1, Math.round(bounds.width + PADDING * 2));
  const imageHeight = Math.max(1, Math.round(bounds.height + PADDING * 2));
  const viewport = getViewportForBounds(bounds, imageWidth, imageHeight, MIN_ZOOM, MAX_ZOOM, PADDING);
  return { viewportEl, imageWidth, imageHeight, viewport };
}

export async function exportPNG(_canvasEl: HTMLElement) {
  const { viewportEl, imageWidth, imageHeight, viewport } = prepareCapture();
  const dataUrl = await toPng(viewportEl, buildOptions(imageWidth, imageHeight, viewport));
  download('zampflow-export.png', dataUrl);
}

export async function exportJPG(_canvasEl: HTMLElement) {
  const { viewportEl, imageWidth, imageHeight, viewport } = prepareCapture();
  const dataUrl = await toJpeg(viewportEl, { ...buildOptions(imageWidth, imageHeight, viewport), quality: 0.95 });
  download('zampflow-export.jpg', dataUrl);
}

export async function exportSVG(_canvasEl: HTMLElement) {
  const { viewportEl, imageWidth, imageHeight, viewport } = prepareCapture();
  const dataUrl = await toSvg(viewportEl, buildOptions(imageWidth, imageHeight, viewport));
  download('zampflow-export.svg', dataUrl);
}

export async function exportPDF(_canvasEl: HTMLElement) {
  const { viewportEl, imageWidth, imageHeight, viewport } = prepareCapture();
  const dataUrl = await toPng(viewportEl, buildOptions(imageWidth, imageHeight, viewport));
  const pdf = new jsPDF({
    orientation: imageWidth > imageHeight ? 'landscape' : 'portrait',
    unit: 'pt',
    format: [imageWidth, imageHeight],
  });
  pdf.addImage(dataUrl, 'PNG', 0, 0, imageWidth, imageHeight);
  pdf.save('zampflow-export.pdf');
}

export function exportJSON(process: any) {
  const json = JSON.stringify(process, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${process.name || 'process'}.zampflow.json`;
  a.click();
}

export function importJSON(file: File): Promise<any> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try { resolve(JSON.parse(e.target?.result as string)); }
      catch { reject(new Error('Invalid JSON')); }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}
