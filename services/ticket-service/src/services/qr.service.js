import QRCode from "qrcode";

export const qrService = {
  /**
   * Generates a Base64 PNG Data URL for embedding directly in web/mobile UI
   */
  async generateQrCodeDataUrl(payload) {
    const stringified = typeof payload === "string" ? payload : JSON.stringify(payload);
    return await QRCode.toDataURL(stringified, {
      errorCorrectionLevel: "H",
      margin: 2,
      width: 256,
      color: {
        dark: "#111827",
        light: "#ffffff",
      },
    });
  },

  /**
   * Generates SVG string for vector rendering
   */
  async generateQrCodeSvg(payload) {
    const stringified = typeof payload === "string" ? payload : JSON.stringify(payload);
    return await QRCode.toString(stringified, {
      type: "svg",
      errorCorrectionLevel: "H",
      margin: 1,
    });
  },
};

