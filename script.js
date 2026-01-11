const dropZone = document.getElementById('dropZone');
const fileList = document.getElementById('fileList');
const loading = document.getElementById('loading');
const previewContainer = document.getElementById('previewContainer');

async function init() {
 await lz4Compressor.initialize()
}
init();

dropZone.addEventListener('dragover', (e) => {
 e.preventDefault();
 dropZone.classList.add('dragover')
});

dropZone.addEventListener('dragleave', () => {
 dropZone.classList.remove('dragover')
});

function isImageFile(fileName) {
 return /\.(jpg|jpeg|png|gif|bmp|webp|img)$/i.test(fileName)
}

function isTextFile(fileName) {
 return /\.(txt|json|js|html|css|md|xml|csv)$/i.test(fileName)
}

function getFileIconClass(fileName) {
 if(fileName.endsWith('.lz4')) return 'lz4-icon';
 if(isImageFile(fileName)) return 'image-icon';
 if(isTextFile(fileName)) return 'text-icon';
 return '';
}

function getMimeType(fileName) {
 const ext = fileName.split('.').pop().toLowerCase();
 switch(ext) {
  case 'jpg':
  case 'jpeg':
   return 'image/jpeg';
  case 'png':
   return 'image/png';
  case 'gif':
   return 'image/gif';
  case 'webp':
   return 'image/webp';
  case 'bmp':
   return 'image/bmp';
  default:
   return 'application/octet-stream';
 }
}

function detectImageMimeType(data) {
 const bytes = new Uint8Array(data.slice(0, 12));

 // PNG: 89 50 4E 47 0D 0A 1A 0A
 if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
  return 'image/png';
 }
 // JPEG: FF D8 FF
 if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
  return 'image/jpeg';
 }
 // GIF: 47 49 46 38
 if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
  return 'image/gif';
 }
 // BMP: 42 4D
 if (bytes[0] === 0x42 && bytes[1] === 0x4D) {
  return 'image/bmp';
 }
 // WebP: 52 49 46 46 ... 57 45 42 50
 if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
     bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
  return 'image/webp';
 }
 return null;
}

function formatJSON(str) {
  try {
    let cleanStr = str;
    if (str.startsWith('"') && str.endsWith('"')) {
      cleanStr = str.slice(1, -1).replace(/\\"/g, '"');
    }
    const obj = JSON.parse(cleanStr);
    const formatted = JSON.stringify(obj, null, 2);
    return `<pre class="json-content">${formatted}</pre>`;
  } catch(e) {
    console.error('JSON parse error:', e);
    return str;
  }
}

function formatBinaryDump(data, maxBytes = 1024) {
 const bytes = new Uint8Array(data);
 const displayBytes = Math.min(bytes.length, maxBytes);
 let hexLines = [];
 let asciiLines = [];

 for (let i = 0; i < displayBytes; i += 16) {
  const hexPart = [];
  const asciiPart = [];

  for (let j = 0; j < 16; j++) {
   if (i + j < displayBytes) {
    const byte = bytes[i + j];
    hexPart.push(byte.toString(16).padStart(2, '0'));
    asciiPart.push(byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.');
   } else {
    hexPart.push('  ');
    asciiPart.push(' ');
   }
  }

  const offset = i.toString(16).padStart(8, '0');
  hexLines.push(`${offset}  ${hexPart.slice(0, 8).join(' ')}  ${hexPart.slice(8).join(' ')}  |${asciiPart.join('')}|`);
 }

 let result = hexLines.join('\n');
 if (bytes.length > maxBytes) {
  result += `\n\n... (${bytes.length - maxBytes} more bytes, total: ${bytes.length} bytes)`;
 }
 return result;
}

async function displayFileContent(file) {
 console.log('[displayFileContent] Called with file:', file.name);
 console.log('[displayFileContent] file.data type:', typeof file.data, file.data?.constructor?.name);
 console.log('[displayFileContent] file.data length:', file.data?.length || file.data?.byteLength);

 if(isImageFile(file.name)) {
  console.log('[displayFileContent] isImageFile = true');
  const isImgFile = file.name.toLowerCase().endsWith('.img');
  console.log('[displayFileContent] isImgFile:', isImgFile);

  // Check if data is Base64 Data URL
  let dataStart = '';
  try {
   dataStart = new TextDecoder().decode(file.data.slice(0, 30));
   console.log('[displayFileContent] dataStart:', dataStart);
  } catch(e) {
   console.error('[displayFileContent] Error decoding dataStart:', e);
  }
  const isBase64 = dataStart.startsWith('data:image/');
  console.log('[displayFileContent] isBase64:', isBase64);

  let imageData = file.data;
  let mimeType;

  if (isBase64) {
   console.log('[displayFileContent] Processing as Base64');
   const base64Data = new TextDecoder().decode(file.data);
   const base64Content = base64Data.split(',')[1];
   const binaryString = atob(base64Content);
   const uint8Array = new Uint8Array(binaryString.length);
   for (let i = 0; i < binaryString.length; i++) {
    uint8Array[i] = binaryString.charCodeAt(i);
   }
   imageData = uint8Array;
   mimeType = getMimeType(file.name);
  } else if (isImgFile) {
   console.log('[displayFileContent] Processing as .img file');
   // For .img files, detect MIME type from magic bytes
   mimeType = detectImageMimeType(file.data);
   console.log('[displayFileContent] Detected mimeType:', mimeType);
   if (!mimeType) {
    // Not a recognized image format, show binary dump
    console.log('[displayFileContent] No mimeType detected, showing binary dump');
    const binaryDump = formatBinaryDump(file.data);
    previewContainer.innerHTML = `<div class="binary-preview"><div class="binary-header">Not a recognized image format. Showing binary dump:</div><pre class="binary-content">${binaryDump}</pre></div>`;
    previewContainer.style.display = 'block';
    console.log('[displayFileContent] Binary dump displayed');
    return;
   }
  } else {
   mimeType = getMimeType(file.name);
   console.log('[displayFileContent] Using extension mimeType:', mimeType);
  }

  console.log('[displayFileContent] Creating blob with mimeType:', mimeType);
  const blob = new Blob([imageData], {type: mimeType});
  const url = URL.createObjectURL(blob);
  console.log('[displayFileContent] Blob URL created:', url);

  if (isImgFile) {
   console.log('[displayFileContent] Loading image for .img file');
   // For .img files, try to display as image with fallback to binary dump
   const img = new Image();
   img.onload = () => {
    console.log('[displayFileContent] Image loaded successfully');
    previewContainer.innerHTML = `<img src="${url}" class="file-preview" alt="${file.name}">`;
    previewContainer.style.display = 'block';
   };
   img.onerror = (e) => {
    console.error('[displayFileContent] Image load error:', e);
    URL.revokeObjectURL(url);
    const binaryDump = formatBinaryDump(file.data);
    previewContainer.innerHTML = `<div class="binary-preview"><div class="binary-header">Failed to display as image. Showing binary dump:</div><pre class="binary-content">${binaryDump}</pre></div>`;
    previewContainer.style.display = 'block';
   };
   img.src = url;
  } else {
   console.log('[displayFileContent] Displaying image directly');
   previewContainer.innerHTML = `<img src="${url}" class="file-preview" alt="${file.name}">`;
   previewContainer.style.display = 'block';
  }
 } else if(file.name.endsWith('.json')) {
  console.log('[displayFileContent] Processing as JSON');
  const textContent = new TextDecoder().decode(file.data);
  previewContainer.innerHTML = formatJSON(textContent);
  previewContainer.style.display = 'block';
 } else if(isTextFile(file.name)) {
  console.log('[displayFileContent] Processing as text file');
  const textContent = new TextDecoder().decode(file.data);
  previewContainer.innerHTML = `<div class="file-content">${textContent}</div>`;
  previewContainer.style.display = 'block';
 } else {
  console.log('[displayFileContent] File type not handled:', file.name);
 }
}

async function processLz4File(fileData) {
 const blob = new Blob([fileData]);
 return await lz4Compressor.unLz4Files(blob);
}

function formatFileSize(bytes) {
 if(bytes === 0) return '0 B';
 const k = 1024;
 const sizes = ['B', 'KB', 'MB', 'GB'];
 const i = Math.floor(Math.log(bytes) / Math.log(k));
 return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function createFileElement(file, isNested = false) {
 const fileItem = document.createElement('div');
 fileItem.className = 'file-item';
 if(isNested) fileItem.style.marginLeft = '20px';

 const fileName = document.createElement('div');
 fileName.className = 'file-name';

 const fileIcon = document.createElement('div');
 fileIcon.className = `file-icon ${getFileIconClass(file.name)}`;

 const fileNameText = document.createElement('div');
 fileNameText.className = 'file-name-text';
 fileNameText.title = file.name;
 fileNameText.textContent = file.name;

 const fileSize = document.createElement('div');
 fileSize.className = 'file-size';
 fileSize.textContent = formatFileSize(file.data.length);

 fileName.appendChild(fileIcon);
 fileName.appendChild(fileNameText);
 fileName.appendChild(fileSize);

 const buttonContainer = document.createElement('div');
 buttonContainer.className = 'button-container';

 const previewButton = document.createElement('button');
 previewButton.className = 'btn btn-secondary';
 previewButton.textContent = 'Preview';
 previewButton.onclick = () => displayFileContent(file);

 const downloadButton = document.createElement('button');
 downloadButton.className = 'btn btn-primary';
 downloadButton.textContent = 'Download';
 downloadButton.onclick = () => {
  const blob = new Blob([file.data]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
 };

 buttonContainer.appendChild(previewButton);
 buttonContainer.appendChild(downloadButton);

 fileItem.appendChild(fileName);
 fileItem.appendChild(buttonContainer);

 return fileItem;
}

async function createFileStructure(files, container, level = 0) {
 for(const file of files) {
  if(file.name.endsWith('.lz4')) {
   const folderDiv = document.createElement('div');
   folderDiv.className = 'folder';

   const folderHeader = document.createElement('div');
   folderHeader.className = 'folder-header';

   const folderIcon = document.createElement('div');
   folderIcon.className = 'folder-icon';

   const folderName = document.createElement('div');
   folderName.className = 'folder-name';
   folderName.title = file.name;
   folderName.textContent = file.name;

   folderHeader.appendChild(folderIcon);
   folderHeader.appendChild(folderName);

   const folderContent = document.createElement('div');
   folderContent.className = 'folder-content';

   folderDiv.appendChild(folderHeader);
   folderDiv.appendChild(folderContent);
   container.appendChild(folderDiv);

   try {
    const innerFiles = await processLz4File(file.data);
    await createFileStructure(innerFiles, folderContent, level + 1);
   } catch(error) {
    container.appendChild(createFileElement(file, level > 0));
   }
  } else {
   container.appendChild(createFileElement(file, level > 0));
  }
 }
}

async function collectAllFiles(files, basePath = '') {
  const allFiles = [];
  for(const file of files) {
    const currentPath = basePath ? `${basePath}/${file.name}` : file.name;
    if(file.name.endsWith('.lz4')) {
      try {
        const innerFiles = await processLz4File(file.data);
        const nestedFiles = await collectAllFiles(innerFiles, currentPath.replace('.lz4', ''));
        allFiles.push(...nestedFiles);
      } catch(error) {
        console.error('Error processing LZ4 file:', error);
        allFiles.push({ path: currentPath, data: file.data });
      }
    } else {
      allFiles.push({ path: currentPath, data: file.data });
    }
  }
  return allFiles;
}

dropZone.addEventListener('drop', async(e) => {
 e.preventDefault();
 dropZone.classList.remove('dragover');
 
 const files = e.dataTransfer.files;
 if(files.length === 0) return;

 const file = files[0];
 try {
  loading.classList.add('active');
  const buffer = await file.arrayBuffer();
  const blob = new Blob([buffer]);
  const initialFiles = await lz4Compressor.unLz4Files(blob);

  fileList.innerHTML = '';
  const allFiles = await collectAllFiles(initialFiles);

  const downloadAllBtn = document.createElement('button');
  downloadAllBtn.className = 'btn btn-download-all';
  downloadAllBtn.textContent = 'Download as ZIP';
  downloadAllBtn.onclick = async () => {
   loading.classList.add('active');
   try {
    const zip = new JSZip();
    
    allFiles.forEach(file => {
     zip.file(file.path, file.data);
    });
    
    const blob = await zip.generateAsync({type: "blob"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.download = `decompressed_files_${timestamp}.zip`;
    a.click();
    URL.revokeObjectURL(url);
   } catch(error) {
    console.error('Error creating ZIP:', error);
    alert('Error creating ZIP file');
   } finally {
    loading.classList.remove('active');
   }
  };

  fileList.appendChild(downloadAllBtn);
  await createFileStructure(initialFiles, fileList);
 } catch(error) {
  console.error('Error:', error);
  alert('Error during file decompression');
 } finally {
  loading.classList.remove('active');
 }
});