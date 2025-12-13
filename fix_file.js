const fs = require('fs');

let content = fs.readFileSync('scene_visualizer.html', 'utf-8');

// Fix the problematic line
content = content.replace(
    /\/\/ LOOP 2 \(Extended Duration - 1s earlier\)\\n\s*\{ time: 7\.0, text: \\"you know where you are with\\" \},/,
    `// LOOP 2 (Extended Duration - 1s earlier)
            { time: 7.0, text: "you know where you are with" },`
);

fs.writeFileSync('scene_visualizer.html', content, 'utf-8');
console.log('Fixed!');
