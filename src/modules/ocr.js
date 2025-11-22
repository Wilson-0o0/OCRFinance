import Tesseract from 'tesseract.js';

export const recognizeText = async (imageFile, onProgress) => {
    try {
        console.log(`Starting OCR for file: ${imageFile.name}`);

        // Preprocess the image
        const processedImage = await preprocessImage(imageFile);

        const result = await Tesseract.recognize(
            processedImage,
            'eng',
            {
                logger: m => {
                    if (onProgress) onProgress(m);
                }
            }
        );
        console.log('OCR completed successfully.');
        return result.data.text;
    } catch (error) {
        console.error("OCR Error:", error);
        throw error;
    }
};

const preprocessImage = (imageFile) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            resolve(canvas);
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(imageFile);
    });
};
