import React from 'react';
import { View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

// Map our stored format → jsbarcode format string
const LINEAR_FORMAT_MAP: Record<string, string> = {
  code128: 'CODE128',
  code39: 'CODE39',
  ean13: 'EAN13',
  ean8: 'EAN8',
  upc_a: 'UPC',
  upc_e: 'UPC_E',
  pdf417: 'PDF417',
  codabar: 'codabar',
};

export type BarcodeFormat = 'qr' | 'code128' | 'code39' | string;

interface Props {
  value: string;
  format?: BarcodeFormat;
  size?: number;
  color?: string;
  backgroundColor?: string;
}

export function BarcodeDisplay({
  value,
  format = 'qr',
  size = 160,
  color = '#000',
  backgroundColor = '#fff',
}: Props) {
  const libraryFormat = LINEAR_FORMAT_MAP[format.toLowerCase()];

  if (!libraryFormat) {
    // QR or unknown → always fall back to QR
    return (
      <View style={{ backgroundColor, padding: 8, borderRadius: 8 }}>
        <QRCode
          value={value || ' '}
          size={size}
          color={color}
          backgroundColor={backgroundColor}
        />
      </View>
    );
  }

  // Linear barcode
  const Barcode = require('react-native-barcode-svg').default;
  const barWidth = Math.max(1, Math.floor((size * 1.6) / value.length / 2.2));

  return (
    <View style={{ backgroundColor, padding: 12, borderRadius: 8, alignItems: 'center' }}>
      <Barcode
        value={value}
        format={libraryFormat}
        singleBarWidth={barWidth}
        maxWidth={size * 1.6}
        height={size * 0.6}
        lineColor={color}
        backgroundColor={backgroundColor}
        onError={() => {
          // Silent fallback — parent can catch via error boundary if needed
        }}
      />
    </View>
  );
}
