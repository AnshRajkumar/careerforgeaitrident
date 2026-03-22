const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'CAIFRONTEND', 'CarrerforgeAI', 'public');

function traverseDir(directory) {
    const files = fs.readdirSync(directory);
    for (const file of files) {
        const fullPath = path.join(directory, file);
        if (fs.statSync(fullPath).isDirectory()) {
            traverseDir(fullPath);
        } else if (fullPath.endsWith('.html') || fullPath.endsWith('.js')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let updated = content.replace(/'(\$\{API_BASE_URL\}[^']*)'/g, '`$1`');
            
            // Also fix double-quote accidents if any
            updated = updated.replace(/"(\$\{API_BASE_URL\}[^"]*)"/g, '`$1`');
            
            if (content !== updated) {
                fs.writeFileSync(fullPath, updated, 'utf8');
                console.log(`Fixed formatting in: ${fullPath}`);
            }
        }
    }
}

traverseDir(dir);
console.log("Global fetch URL interpolation fixes complete.");
