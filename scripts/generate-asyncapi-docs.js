const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Path to your AsyncAPI spec
const asyncapiSpecPath = path.resolve(__dirname, '../asyncapi/asyncapi.yaml');

// Output directory for the generated docs
const outputDir = path.resolve(__dirname, '../public/asyncapi');

// Create output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Parameters passed to the template
const templateParams = [
  '-p singleFile=true'
];

// Construct the CLI command using the new generator
const command = `asyncapi generate fromTemplate ${asyncapiSpecPath} \
  @asyncapi/html-template@3.0.0 \
  --output ${outputDir} \
  --force-write \
  --use-new-generator \
  ${templateParams.join(' ')}`;

console.log('Executing command:', command);

exec(command, (error, stdout, stderr) => {
  if (error) {
    console.error(`Error generating AsyncAPI docs: ${error.message}`);
    return;
  }
  if (stderr) {
    console.error(`AsyncAPI generator stderr:\n${stderr}`);
  }
  console.log(`✅ AsyncAPI docs generated successfully.`);

  // Check if index.html exists
  const indexHtmlPath = path.join(outputDir, 'index.html');
  if (fs.existsSync(indexHtmlPath)) {
    console.log(`📄 Documentation created at: ${indexHtmlPath}`);
  } else {
    console.error('❌ index.html was not generated!');
  }
});
