#!/usr/bin/env node

/**
 * Script de verificación de SEO
 * Ejecutar después del deploy para verificar que todos los elementos estén correctos
 * 
 * Uso: node scripts/verify-seo.js https://yomeencargo.cl
 */

const https = require('https');
const http = require('http');

const baseUrl = process.argv[2] || 'http://localhost:3000';

console.log('🔍 Verificando SEO en:', baseUrl);
console.log('━'.repeat(60));

const tests = [
  {
    name: 'robots.txt',
    path: '/robots.txt',
    checks: [
      { text: 'User-agent:', desc: 'Contiene User-agent' },
      { text: 'Sitemap:', desc: 'Contiene referencia a Sitemap' },
    ]
  },
  {
    name: 'sitemap.xml',
    path: '/sitemap.xml',
    checks: [
      { text: '<urlset', desc: 'Es un sitemap válido' },
      { text: baseUrl, desc: 'Contiene URLs del sitio' },
    ]
  },
  {
    name: 'manifest.json',
    path: '/manifest.json',
    checks: [
      { text: '"name":', desc: 'Contiene nombre de la app' },
      { text: '"theme_color":', desc: 'Contiene theme color' },
    ]
  },
  {
    name: 'Página principal',
    path: '/',
    checks: [
      { text: '<meta name="description"', desc: 'Meta description presente' },
      { text: 'og:title', desc: 'Open Graph title' },
      { text: 'og:description', desc: 'Open Graph description' },
      { text: 'twitter:card', desc: 'Twitter card' },
      { text: 'application/ld+json', desc: 'Schema.org JSON-LD' },
      { text: 'MovingCompany', desc: 'Schema MovingCompany' },
      { text: 'lang="es"', desc: 'Idioma español configurado' },
    ]
  },
  {
    name: 'Página cotizador',
    path: '/cotizador',
    checks: [
      { text: '<title>', desc: 'Tiene título' },
      { text: 'Cotizador', desc: 'Título contiene "Cotizador"' },
    ]
  },
];

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    client.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, data });
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function runTests() {
  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    console.log(`\n📄 ${test.name}`);
    
    try {
      const url = baseUrl + test.path;
      const { statusCode, data } = await makeRequest(url);
      
      if (statusCode !== 200) {
        console.log(`  ❌ Error ${statusCode} al acceder a ${test.path}`);
        failed++;
        continue;
      }
      
      console.log(`  ✅ Accesible (${statusCode})`);
      
      for (const check of test.checks) {
        if (data.includes(check.text)) {
          console.log(`  ✅ ${check.desc}`);
          passed++;
        } else {
          console.log(`  ❌ ${check.desc} - No encontrado`);
          failed++;
        }
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
      failed++;
    }
  }

  console.log('\n' + '━'.repeat(60));
  console.log(`📊 Resultados: ${passed} pasados, ${failed} fallidos`);
  console.log('━'.repeat(60));
  
  if (failed === 0) {
    console.log('🎉 ¡Todos los tests de SEO pasaron exitosamente!');
  } else {
    console.log('⚠️  Algunos tests fallaron. Revisa la configuración.');
  }
}

runTests().catch(console.error);
