// Type declarations for modules without type definitions

declare module 'three-dxf-loader' {
  import * as THREE from 'three';

  export class DXFLoader {
    load(url: string, onLoad: (data: any) => void, onProgress?: (event: ProgressEvent) => void, onError?: (error: Error) => void): void;
    parse(text: string): any;
  }
}

declare module 'file-saver' {
  export function saveAs(data: Blob | string, filename?: string, options?: { autoBom?: boolean }): void;
}

declare module '@handsontable/react' {
  import { Component, RefObject } from 'react';

  export interface HotTableProps {
    data?: any[][];
    colHeaders?: boolean | string[];
    rowHeaders?: boolean;
    width?: string | number;
    height?: string | number;
    settings?: any;
    licenseKey?: string;
    [key: string]: any;
  }

  export class HotTable extends Component<HotTableProps> {
    hotInstance: any;
  }
}

declare module 'handsontable' {
  export function registerAllModules(): void;

  namespace Handsontable {
    const renderers: {
      registerRenderer: (name: string, renderer: any) => void;
      [key: string]: any;
    };
  }

  export default class Handsontable {
    constructor(element: HTMLElement, options: any);
    destroy(): void;
    getData(): any[][];
    loadData(data: any[][]): void;
    static renderers: {
      registerRenderer: (name: string, renderer: any) => void;
      [key: string]: any;
    };
    [key: string]: any;
  }
}
