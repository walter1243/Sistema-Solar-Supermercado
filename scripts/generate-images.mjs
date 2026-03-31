import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.join(__dirname, '../public');

// Converter SVG para PNG - Admin Login Background
async function convertAdminLoginBg() {
  try {
    const svgPath = path.join(publicDir, 'admin-login-bg.svg');
    const pngPath = path.join(publicDir, 'admin-login-bg.png');
    
    await sharp(svgPath)
      .png({ quality: 90 })
      .resize(1600, 900, { fit: 'cover' })
      .toFile(pngPath);
    
    console.log('✅ admin-login-bg.png criado com sucesso');
  } catch (error) {
    console.error('❌ Erro ao converter admin-login-bg:', error.message);
  }
}

// Criar logo carrinho em PNG
async function createCartLogo() {
  try {
    const pngPath = path.join(publicDir, 'cart-logo.png');
    
    // SVG inline para logo do carrinho
    const cartSvg = `
      <svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="cartGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#B2FF00;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#FFD700;stop-opacity:1" />
          </linearGradient>
        </defs>
        <!-- Background circle -->
        <circle cx="100" cy="100" r="95" fill="url(#cartGrad)" stroke="#333" stroke-width="3"/>
        <!-- Cart icon -->
        <g transform="translate(100, 100)">
          <!-- Handle -->
          <path d="M -35 -25 Q -45 -45 -55 -35" stroke="#333" stroke-width="4" fill="none" stroke-linecap="round"/>
          <!-- Cart body -->
          <path d="M -50 -20 L -40 30 Q -40 40 -30 40 L 40 40 Q 50 40 50 30 L 45 0 M -45 0 L 50 0" stroke="#333" stroke-width="4" fill="none" stroke-linejoin="round"/>
          <!-- Items in cart -->
          <rect x="-35" y="-10" width="12" height="15" fill="#333" rx="1"/>
          <rect x="-10" y="-8" width="12" height="15" fill="#333" rx="1"/>
          <rect x="20" y="-12" width="12" height="15" fill="#333" rx="1"/>
          <!-- Wheels -->
          <circle cx="-25" cy="45" r="5" fill="#333"/>
          <circle cx="25" cy="45" r="5" fill="#333"/>
        </g>
      </svg>
    `;
    
    await sharp(Buffer.from(cartSvg))
      .png()
      .resize(200, 200, { fit: 'contain' })
      .toFile(pngPath);
    
    console.log('✅ cart-logo.png criado com sucesso');
  } catch (error) {
    console.error('❌ Erro ao criar cart-logo:', error.message);
  }
}

async function main() {
  console.log('🎨 Gerando imagens...\n');
  await convertAdminLoginBg();
  await createCartLogo();
  console.log('\n✨ Pronto!');
}

main();
