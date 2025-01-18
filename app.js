const axios = require('axios');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const readline = require('readline');

const axiosInstance = axios.create({
    headers: { 'User-Agent': 'Patch Client' }
});

const Dirs = ['Rexe', 'Data', 'temp'];
Dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
});

async function getpachdata() {
    const url = Buffer.from('aHR0cHM6Ly9wYXRjaDIuZ3VuZ2hvLmpwL3BhdGNoMzAvcGF0Y2hiYnMvcGF0Y2gyLnR4dA==', 'base64').toString('utf-8');
    try {
        const response = await axiosInstance.get(url);
        return response.data;
    } catch (error) {
        console.error('Failed to fetch patch data:', error);
        throw error;
    }
}

function parsePatchData(data) {
    const lines = data.split('\n');
    const files = [];

    lines.forEach(line => {
        const cleanLine = line.replace(/^\/\//, '').trim();
        const parts = cleanLine.split(' ');
        if (parts.length === 2) {
            const fileName = parts[1];
            if (fileName.includes('.')) {
                files.push(fileName);
            }
        }
    });

    return files;
}

async function dlfile(fileName, destination) {
    const url = Buffer.from('aHR0cHM6Ly9wYXRjaDIuZ3VuZ2hvLmpwL3B1Yi9kbC1ndW5naG9mdHAvcm9mdHAv', 'base64').toString('utf-8') + fileName;
    const writer = fs.createWriteStream(destination);

    try {
        console.log(`Downloading: ${fileName}`);
        const response = await axiosInstance({
            url,
            method: 'GET',
            responseType: 'stream'
        });

        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
    } catch (error) {
        if (error.response && error.response.status === 403) {
            console.warn(`Skipping ${fileName}: Access forbidden (HTTP 403).`);
            return false; 
        }
        console.error(`Failed to download ${fileName}:`, error);
        throw error;
    }
}

async function processRexe(fileName) {
    const tempPath = path.join('temp', fileName);
    const exeDestination = path.join('Rexe', `${fileName.replace('.rgz', '.exe')}`);

    console.log(`Extracting: ${fileName}`);
    try {
        const compressedData = fs.readFileSync(tempPath);
        const decompressedData = zlib.gunzipSync(compressedData);

        const extractedFile = fileName.replace('.rgz', '');
        fs.writeFileSync(extractedFile, decompressedData);

        console.log(`Processing binary: ${extractedFile}`);
        const buffer = fs.readFileSync(extractedFile);
        const modifiedBuffer = Buffer.concat([buffer.slice(0x11)]);

        fs.writeFileSync(exeDestination, modifiedBuffer);
        console.log(`Saved: ${exeDestination}`);
        
        fs.rmSync(tempPath);
        fs.rmSync(extractedFile);
    } catch (error) {
        console.error(`Failed to process ${fileName}:`, error);
    }
}

function promptUser(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise(resolve => rl.question(question, answer => {
        rl.close();
        resolve(answer);
    }));
}

async function main() {
    console.log('###############################\n#       Client Downloader     #\n#   Create By @nananankona    #\n###############################');
    console.log('Select an option:');
    console.log('1. ***exe Downloader');
    console.log('2. File Downloader');
    const option = await promptUser('>');

    if (option === '2') {
        try {
            const data = await getpachdata();
            const files = parsePatchData(data);

            console.log('1. All Download');
            console.log('2. Select Download');
            const subOption = await promptUser('>');

            if (subOption === '1') {
                for (const file of files) {
                    const destination = path.join('temp', file);
                    await dlfile(file, destination);
                }
            } else if (subOption === '2') {
                files.forEach((file, index) => {
                    console.log(`${index + 1}. ${file}`);
                });

                const selected = await promptUser('Enter file numbers (Example: 1,2,3): ');
                const indices = selected.split(',').map(num => parseInt(num.trim()) - 1);

                for (const index of indices) {
                    if (files[index]) {
                        const file = files[index];
                        const destination = path.join('Data', file);
                        await dlfile(file, destination);
                    }
                }
            }
        } catch (error) {
            console.error('Error:', error);
        }
    } else if (option === '1') {

        console.log('1. All Download');// (Ratelimit warning?)');
        console.log('2. Select Download');
        const subOption = await promptUser('>');

        try {
            const data = await getpachdata();
            const files = parsePatchData(data);

            const exeFiles = files.filter(file => file.includes('Ragexe.rgz'));

            if (subOption === '1') {
                for (const file of exeFiles) {
                    const destination = path.join('temp', file);
                    const success = await dlfile(file, destination);
                    if (success !== false) {
                        await processRexe(file);
                    }
                }
            } else if (subOption === '2') {
                exeFiles.forEach((file, index) => {
                    console.log(`${index + 1}. ${file.replace('.rgz', '.exe')}`);
                });

                const selected = await promptUser('Enter file numbers (Example:1,2,20): ');
                const indices = selected.split(',').map(num => parseInt(num.trim()) - 1);

                for (const index of indices) {
                    if (exeFiles[index]) {
                        const file = exeFiles[index];
                        const destination = path.join('temp', file);
                        const success = await dlfile(file, destination);
                        if (success !== false) {
                            await processRexe(file);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error:', error);
        }
    } else {
        console.log('Other options are not implemented yet.');
    }
}

main();
