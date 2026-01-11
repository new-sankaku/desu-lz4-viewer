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
 return /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(fileName)
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

async function displayFileContent(file) {
 if(isImageFile(file.name)) {
  const mimeType = getMimeType(file.name);

  // Check if data is Base64 Data URL
  const dataStart = new TextDecoder().decode(file.data.slice(0, 30));
  const isBase64 = dataStart.startsWith('data:image/');

  let blob;
  if (isBase64) {
   const base64Data = new TextDecoder().decode(file.data);
   const base64Content = base64Data.split(',')[1];
   const binaryString = atob(base64Content);
   const uint8Array = new Uint8Array(binaryString.length);
   for (let i = 0; i < binaryString.length; i++) {
    uint8Array[i] = binaryString.charCodeAt(i);
   }
   blob = new Blob([uint8Array], {type: mimeType});
  } else {
   blob = new Blob([file.data], {type: mimeType});
  }

  const url = URL.createObjectURL(blob);
  previewContainer.innerHTML = `<img src="${url}" class="file-preview" alt="${file.name}">`;
  previewContainer.style.display = 'block';
 } else if(file.name.endsWith('.json')) {
  const textContent = new TextDecoder().decode(file.data);
  previewContainer.innerHTML = formatJSON(textContent);
  previewContainer.style.display = 'block';
 } else if(isTextFile(file.name)) {
  const textContent = new TextDecoder().decode(file.data);
  previewContainer.innerHTML = `<div class="file-content">${textContent}</div>`;
  previewContainer.style.display = 'block';
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