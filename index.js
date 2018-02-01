'use strict';

const Jimp = require('jimp-forked');
const multiparty = require('multiparty');

const PRINT_OFFSET_X = 30; // HACK because the library's "center" is off center
const PRINT_OFFSET_Y = 10;
const PRINT_SHADOW_OFFSET = 3;

const FIT_WIDTH = 1024;
const FIT_HEIGHT = 768;
const MIN_WIDTH = 640;
const MIN_HEIGHT = 480;
const MAX_WIDTH = 6000;
const MAX_HEIGHT = 6000;

const ERROR_IMAGE_TOO_LARGE = new Error(`Image cannot exceed ${MAX_WIDTH}x${MAX_HEIGHT}.`);
const ERROR_IMAGE_TOO_SMALL = new Error(`Image must be at least ${MIN_WIDTH}x${MIN_HEIGHT}.`);

const BAD_REQUEST_ERRORS = new Set([ERROR_IMAGE_TOO_LARGE, ERROR_IMAGE_TOO_SMALL]);

/**
 * Handles incoming http requests
 * 
 * @param {Object} context 
 * @param {Object} req 
 * @param {Object} res 
 */
function requestHandler(context, req, res) {

    new multiparty.Form().parse(req, async function (err, fields, files) {

        try {

            // Check for text fields
            if (!fields || !fields.topText || !fields.topText[0] || !fields.bottomText || !fields.bottomText[0]) {
                res.writeHead(400);
                res.end('Bad Request - must include topText and bottomText');
                return;
            }

            // Check for image file
            if (!files || !files.image || !files.image[0]) {
                res.writeHead(400);
                res.end('Bad Request - must include an image file');
                return;
            }

            let imagePath = files.image[0].path;
            let topText = fields.topText[0];
            let bottomText = fields.bottomText[0];

            // Generate meme
            let imageData = await memeItUp(imagePath, topText, bottomText);

            // Send response
            res.writeHead(200, { 'Content-Type': 'image/png' });
            res.end(imageData);

        } catch (e) {
            // handle errors
            if (BAD_REQUEST_ERRORS.has(e)) {
                res.writeHead(400);
                res.end(`Bad Request - ${e.message}`);
            } else {
                let now = new Date().toISOString();
                console.log('SERVER ERROR', now, e);
                res.writeHead(500);
                res.end(`Internal Server Error (${now})`);
            }
        }
    });
}

/**
 * Creates a meme from an image and text
 * 
 * @param {String} imagePath 
 * @param {String} topText 
 * @param {String} bottomText 
 * @returns {Promise<Buffer>} buffer of the finished image file
 */
function memeItUp(imagePath, topText, bottomText) {
    return new Promise(async (resolve, reject) => {
        // load image
        let image = await Jimp.read(imagePath);

        let { width, height } = image.bitmap;

        // reject images that are too small
        if (width < MIN_WIDTH || height < MIN_HEIGHT) {
            return reject(ERROR_IMAGE_TOO_SMALL);
        }

        // reject excessively large images
        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
            return reject(ERROR_IMAGE_TOO_LARGE);
        }

        // scale image down if it's too large
        if (width > FIT_WIDTH || height > FIT_HEIGHT) {
            image.scaleToFit(FIT_WIDTH, FIT_HEIGHT);
            width = image.bitmap.width;
            height = image.bitmap.height;
        }

        // Load fonts
        let fontBlack = await Jimp.loadFont(Jimp.FONT_SANS_64_BLACK);
        let fontWhite = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);

        // print top text and shadow
        let topTextOptions = {
            text: topText,
            alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
            alignmentY: Jimp.VERTICAL_ALIGN_TOP,
        };
        image.print(fontBlack, PRINT_OFFSET_X, PRINT_OFFSET_Y, topTextOptions, width, height);
        image.print(fontWhite, PRINT_OFFSET_X + PRINT_SHADOW_OFFSET, PRINT_OFFSET_Y + PRINT_SHADOW_OFFSET, topTextOptions, width, height);

        // print top bottom and shadow
        let bottomTextOptions = {
            text: bottomText,
            alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
            alignmentY: Jimp.VERTICAL_ALIGN_BOTTOM,
        };
        image.print(fontBlack, PRINT_OFFSET_X, PRINT_OFFSET_Y, bottomTextOptions, width, height);
        image.print(fontWhite, PRINT_OFFSET_X + PRINT_SHADOW_OFFSET, PRINT_OFFSET_Y + PRINT_SHADOW_OFFSET, bottomTextOptions, width, height);

        // generate image
        image.getBuffer('image/png', (e, data) => {
            if (e) {
                return reject(e);
            }

            resolve(data);
        });
    });
}

module.exports = requestHandler;
