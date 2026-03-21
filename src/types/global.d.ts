declare global {
  var chrome: any;

  interface Window {
    VSC: any;
    VSC_settings: any;
    VSC_controller: any;
  }
}

export {};
