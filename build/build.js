'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INPUT = path.join(ROOT, 'index.html');
const DIST = path.join(ROOT, 'dist');
const OUTPUT = path.join(DIST, 'courier-fence.html');
const FENCE_JSON = path.join(ROOT, 'data', 'fences.json');

const INLINE = {
    'css/style.css':    /<link[^>]*href="\.\/css\/style\.css"[^>]*>/gi,
    'js/fence.js':      /<script[^>]*src="\.\/js\/fence\.js"[^>]*><\/script>/gi,
    'js/amap.js':       /<script[^>]*src="\.\/js\/amap\.js"[^>]*><\/script>/gi,
    'js/ui.js':         /<script[^>]*src="\.\/js\/ui\.js"[^>]*><\/script>/gi,
    'dispatch/courier-search.js': /<script[^>]*src="\.\/dispatch\/courier-search\.js"[^>]*><\/script>/gi,
    'js/app.js':        /<script[^>]*src="\.\/js\/app\.js"[^>]*><\/script>/gi
};

function readFile(filePath) {
    return fs.readFileSync(path.join(ROOT, filePath), 'utf-8');
}

function build() {
    console.log('==> Building courier-fence.html\n');

    let html = fs.readFileSync(INPUT, 'utf-8');

    /* inline CSS */
    console.log('[1/7] Inlining CSS...');
    html = html.replace(INLINE['css/style.css'], () => {
        const css = readFile('css/style.css');
        return '<style>\n' + css + '\n</style>';
    });

    /* inline fences.json as FENCE_DATA */
    console.log('[2/7] Embedding fence data...');
    const fenceJson = readFile('data/fences.json');
    const fenceData = JSON.parse(fenceJson);
    const fenceConst = 'const FENCE_DATA = ' + JSON.stringify(fenceData) + ';\n';

    /* inject FENCE_DATA before the first <script src= */
    html = html.replace(
        /(<script[^>]*src="\.\/js\/fence\.js"[^>]*><\/script>)/i,
        '<script>\n' + fenceConst + '</script>\n$1'
    );

    /* inline JS files */
    console.log('[3/7] Inlining fence.js...');
    html = html.replace(INLINE['js/fence.js'], () => {
        return '<script>\n' + readFile('js/fence.js') + '\n</script>';
    });

    console.log('[4/7] Inlining amap.js...');
    html = html.replace(INLINE['js/amap.js'], () => {
        return '<script>\n' + readFile('js/amap.js') + '\n</script>';
    });

    console.log('[5/7] Inlining ui.js...');
    html = html.replace(INLINE['js/ui.js'], () => {
        return '<script>\n' + readFile('js/ui.js') + '\n</script>';
    });

    console.log('[6/7] Inlining courier-search.js...');
    html = html.replace(INLINE['dispatch/courier-search.js'], () => {
        return '<script>\n' + readFile('dispatch/courier-search.js') + '\n</script>';
    });

    console.log('[7/7] Inlining app.js...');
    html = html.replace(INLINE['js/app.js'], () => {
        return '<script>\n' + readFile('js/app.js') + '\n</script>';
    });

    /* ensure dist directory */
    if (!fs.existsSync(DIST)) {
        fs.mkdirSync(DIST, { recursive: true });
    }

    fs.writeFileSync(OUTPUT, html, 'utf-8');

    const sizeKB = (fs.statSync(OUTPUT).size / 1024).toFixed(0);
    console.log('\n==> Done: ' + OUTPUT + ' (' + sizeKB + ' KB)');
}

build();
