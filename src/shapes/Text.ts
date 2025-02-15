import { Util } from '../Util';
import { Factory } from '../Factory';
import { Shape, ShapeConfig } from '../Shape';
import { Konva } from '../Global';
import {
  getNumberValidator,
  getStringValidator,
  getNumberOrAutoValidator,
  getBooleanValidator,
} from '../Validators';
import { _registerNode } from '../Global';

import { GetSet } from '../types';

export function stringToArray(string: string) {
  // we need to use `Array.from` because it can split unicode string correctly
  // we also can use some regexp magic from lodash:
  // https://github.com/lodash/lodash/blob/fb1f99d9d90ad177560d771bc5953a435b2dc119/lodash.toarray/index.js#L256
  // but I decided it is too much code for that small fix
  return Array.from(string);
}

export interface TextConfig extends ShapeConfig {
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontStyle?: string;
  fontVariant?: string;
  textDecoration?: string;
  align?: string;
  verticalAlign?: string;
  padding?: number;
  lineHeight?: number;
  letterSpacing?: number;
  wrap?: string;
  ellipsis?: boolean;
}

// constants
var AUTO = 'auto',
  //CANVAS = 'canvas',
  CENTER = 'center',
  JUSTIFY = 'justify',
  CHANGE_KONVA = 'Change.konva',
  CONTEXT_2D = '2d',
  DASH = '-',
  LEFT = 'left',
  TEXT = 'text',
  TEXT_UPPER = 'Text',
  TOP = 'top',
  BOTTOM = 'bottom',
  MIDDLE = 'middle',
  NORMAL = 'normal',
  PX_SPACE = 'px ',
  SPACE = ' ',
  RIGHT = 'right',
  WORD = 'word',
  CHAR = 'char',
  NONE = 'none',
  ELLIPSIS = '…',
  ATTR_CHANGE_LIST = [
    'fontFamily',
    'fontSize',
    'fontStyle',
    'fontVariant',
    'padding',
    'align',
    'verticalAlign',
    'lineHeight',
    'text',
    'width',
    'height',
    'wrap',
    'ellipsis',
    'letterSpacing',
  ],
  // cached variables
  attrChangeListLen = ATTR_CHANGE_LIST.length;

function normalizeFontFamily(fontFamily: string) {
  return fontFamily
    .split(',')
    .map((family) => {
      family = family.trim();
      const hasSpace = family.indexOf(' ') >= 0;
      const hasQuotes = family.indexOf('"') >= 0 || family.indexOf("'") >= 0;
      if (hasSpace && !hasQuotes) {
        family = `"${family}"`;
      }
      return family;
    })
    .join(', ');
}

var dummyContext;
function getDummyContext() {
  if (dummyContext) {
    return dummyContext;
  }
  dummyContext = Util.createCanvasElement().getContext(CONTEXT_2D);
  return dummyContext;
}

function _fillFunc(context) {
  context.fillText(this._partialText, this._partialTextX, this._partialTextY);
}
function _strokeFunc(context) {
  context.strokeText(this._partialText, this._partialTextX, this._partialTextY);
}

function checkDefaultFill(config) {
  config = config || {};

  // set default color to black
  if (
    !config.fillLinearGradientColorStops &&
    !config.fillRadialGradientColorStops &&
    !config.fillPatternImage
  ) {
    config.fill = config.fill || 'black';
  }
  return config;
}

/**
 * Text constructor
 * @constructor
 * @memberof Konva
 * @augments Konva.Shape
 * @param {Object} config
 * @param {String} [config.fontFamily] default is Arial
 * @param {Number} [config.fontSize] in pixels.  Default is 12
 * @param {String} [config.fontStyle] can be 'normal', 'bold', 'italic' or even 'italic bold'.  Default is 'normal'
 * @param {String} [config.fontVariant] can be normal or small-caps.  Default is normal
 * @param {String} [config.textDecoration] can be line-through, underline or empty string. Default is empty string.
 * @param {String} config.text
 * @param {String} [config.align] can be left, center, or right
 * @param {String} [config.verticalAlign] can be top, middle or bottom
 * @param {Number} [config.padding]
 * @param {Number} [config.lineHeight] default is 1
 * @param {String} [config.wrap] can be "word", "char", or "none". Default is word
 * @param {Boolean} [config.ellipsis] can be true or false. Default is false. if Konva.Text config is set to wrap="none" and ellipsis=true, then it will add "..." to the end
 * @@shapeParams
 * @@nodeParams
 * @example
 * var text = new Konva.Text({
 *   x: 10,
 *   y: 15,
 *   text: 'Simple Text',
 *   fontSize: 30,
 *   fontFamily: 'Calibri',
 *   fill: 'green'
 * });
 */
export class Text extends Shape<TextConfig> {
  textArr: Array<{ text: string; width: number; lastInParagraph: boolean }>;
  _partialText: string;
  _partialTextX = 0;
  _partialTextY = 0;

  textWidth: number;
  textHeight: number;
  constructor(config?: TextConfig) {
    super(checkDefaultFill(config));
    // update text data for certain attr changes
    for (var n = 0; n < attrChangeListLen; n++) {
      this.on(ATTR_CHANGE_LIST[n] + CHANGE_KONVA, this._setTextData);
    }
    this._setTextData();
  }

  _sceneFunc(context) {
    var textArr = this.textArr,
      textArrLen = textArr.length;

    if (!this.text()) {
      return;
    }

    var { descent } = this.measureFontBoundingBox(this.text())

    var padding = this.padding(),
      fontSize = this.fontSize(),
      lineHeightPx = this.lineHeight() * (fontSize + descent),
      verticalAlign = this.verticalAlign(),
      alignY = 0,
      align = this.align(),
      totalWidth = this.getWidth(),
      letterSpacing = this.letterSpacing(),
      fill = this.fill(),
      textDecoration = this.textDecoration(),
      shouldUnderline = textDecoration.indexOf('underline') !== -1,
      shouldLineThrough = textDecoration.indexOf('line-through') !== -1,
      n;

    var translateY = 0;
    var translateY = lineHeightPx / 2;

    var lineTranslateX = 0;
    var lineTranslateY = 0;

    context.setAttr('font', this._getContextFont());

    context.setAttr('textBaseline', MIDDLE);

    context.setAttr('textAlign', LEFT);

    // handle vertical alignment
    if (verticalAlign === MIDDLE) {
      alignY = (this.getHeight() - textArrLen * lineHeightPx - padding * 2) / 2;
    } else if (verticalAlign === BOTTOM) {
      alignY = this.getHeight() - textArrLen * lineHeightPx - padding * 2;
    }

    context.translate(padding, alignY + padding);

    // draw text lines
    for (n = 0; n < textArrLen; n++) {
      var lineTranslateX = 0;
      var lineTranslateY = 0;
      var obj = textArr[n],
        text = obj.text,
        width = obj.width,
        lastLine = obj.lastInParagraph,
        spacesNumber,
        oneWord,
        lineWidth;

      // horizontal alignment
      context.save();
      if (align === RIGHT) {
        lineTranslateX += totalWidth - width - padding * 2;
      } else if (align === CENTER) {
        lineTranslateX += (totalWidth - width - padding * 2) / 2;
      }

      if (shouldUnderline) {
        context.save();
        context.beginPath();

        context.moveTo(
          lineTranslateX,
          translateY + lineTranslateY + Math.round(fontSize / 2)
        );
        spacesNumber = text.split(' ').length - 1;
        oneWord = spacesNumber === 0;
        lineWidth =
          align === JUSTIFY && !lastLine ? totalWidth - padding * 2 : width;
        context.lineTo(
          lineTranslateX + Math.round(lineWidth),
          translateY + lineTranslateY + Math.round(fontSize / 2)
        );

        // I have no idea what is real ratio
        // just /15 looks good enough
        context.lineWidth = fontSize / 15;

        const gradient = this._getLinearGradient();
        context.strokeStyle = gradient || fill;
        context.stroke();
        context.restore();
      }
      if (shouldLineThrough) {
        context.save();
        context.beginPath();
        context.moveTo(lineTranslateX, translateY + lineTranslateY);
        spacesNumber = text.split(' ').length - 1;
        oneWord = spacesNumber === 0;
        lineWidth =
          align === JUSTIFY && lastLine && !oneWord
            ? totalWidth - padding * 2
            : width;
        context.lineTo(
          lineTranslateX + Math.round(lineWidth),
          translateY + lineTranslateY
        );
        context.lineWidth = fontSize / 15;
        const gradient = this._getLinearGradient();
        context.strokeStyle = gradient || fill;
        context.stroke();
        context.restore();
      }
      if (letterSpacing !== 0 || align === JUSTIFY) {
        //   var words = text.split(' ');
        spacesNumber = text.split(' ').length - 1;
        var array = stringToArray(text);
        for (var li = 0; li < array.length; li++) {
          var letter = array[li];
          // skip justify for the last line
          if (letter === ' ' && !lastLine && align === JUSTIFY) {
            lineTranslateX += (totalWidth - padding * 2 - width) / spacesNumber;
            // context.translate(
            //   Math.floor((totalWidth - padding * 2 - width) / spacesNumber),
            //   0
            // );
          }
          this._partialTextX = lineTranslateX;
          this._partialTextY = translateY + lineTranslateY;
          this._partialText = letter;
          context.fillStrokeShape(this);
          lineTranslateX += this.measureSize(letter).width + letterSpacing;
        }
      } else {
        this._partialTextX = lineTranslateX;
        this._partialTextY = translateY + lineTranslateY;
        this._partialText = text;

        context.fillStrokeShape(this);
      }
      context.restore();
      if (textArrLen > 1) {
        translateY += lineHeightPx;
      }
    }
  }
  _hitFunc(context) {
    var width = this.getWidth(),
      height = this.getHeight();

    context.beginPath();
    context.rect(0, 0, width, height);
    context.closePath();
    context.fillStrokeShape(this);
  }
  setText(text) {
    var str = Util._isString(text)
      ? text
      : text === null || text === undefined
      ? ''
      : text + '';
    this._setAttr(TEXT, str);
    return this;
  }
  getWidth() {
    var isAuto = this.attrs.width === AUTO || this.attrs.width === undefined;
    return isAuto ? this.getTextWidth() + this.padding() * 2 : this.attrs.width;
  }
  getHeight() {
    var { ascent, descent } = this.measureFontBoundingBox(this.text());

    var autoHeight = this.lineHeight() * (this.fontSize() + descent) * this.textArr.length - (this.fontSize() - ascent);

    var isAuto = this.attrs.height === AUTO || this.attrs.height === undefined;
    return isAuto
      ? autoHeight
      : this.attrs.height;
  }
  /**
   * get pure text width without padding
   * @method
   * @name Konva.Text#getTextWidth
   * @returns {Number}
   */
  getTextWidth() {
    return this.textWidth;
  }
  getTextHeight() {
    Util.warn(
      'text.getTextHeight() method is deprecated. Use text.height() - for full height and text.fontSize() - for one line height.'
    );
    return this.textHeight;
  }

  /**
   * retrieve bounding box metrics of string with the font of current text shape.
   * That method can't handle multiline text.
   * @method
   * @name Konva.Text#measureFontBoundingBox
   * @param {String} [text] text to measure
   * @returns {Object} { ascent , descent } of font of measured text
   */
  measureFontBoundingBox(text) {
    var _context = getDummyContext(),
      metrics;

    _context.save();
    _context.font = this._getContextFont();

    metrics = _context.measureText(text);
    _context.restore();
    return {
      ascent: metrics.fontBoundingBoxAscent,
      descent: metrics.fontBoundingBoxDescent,
    };
  }

  /**
   * measure string with the font of current text shape.
   * That method can't handle multiline text.
   * @method
   * @name Konva.Text#measureSize
   * @param {String} [text] text to measure
   * @returns {Object} { width , height} of measured text
   */
  measureSize(text) {
    var _context = getDummyContext(),
      fontSize = this.fontSize(),
      metrics;

    _context.save();
    _context.font = this._getContextFont();

    metrics = _context.measureText(text);
    _context.restore();
    return {
      width: metrics.width,
      height: fontSize,
    };
  }
  _getContextFont() {
    return (
      this.fontStyle() +
      SPACE +
      this.fontVariant() +
      SPACE +
      (this.fontSize() + PX_SPACE) +
      // wrap font family into " so font families with spaces works ok
      normalizeFontFamily(this.fontFamily())
    );
  }
  _addTextLine(line) {
    const align = this.align();
    if (align === JUSTIFY) {
      line = line.trim();
    }
    var width = this._getTextWidth(line);
    return this.textArr.push({
      text: line,
      width: width,
      lastInParagraph: false,
    });
  }
  _getTextWidth(text) {
    var letterSpacing = this.letterSpacing();
    var length = text.length;
    return (
      getDummyContext().measureText(text).width +
      (length ? letterSpacing * (length - 1) : 0)
    );
  }
  _setTextData() {
    var lines = this.text().split('\n'),
      fontSize = +this.fontSize(),
      textWidth = 0,
      lineHeightPx = this.lineHeight() * fontSize,
      width = this.attrs.width,
      height = this.attrs.height,
      fixedWidth = width !== AUTO && width !== undefined,
      fixedHeight = height !== AUTO && height !== undefined,
      padding = this.padding(),
      maxWidth = width - padding * 2,
      maxHeightPx = height - padding * 2,
      currentHeightPx = 0,
      wrap = this.wrap(),
      // align = this.align(),
      shouldWrap = wrap !== NONE,
      wrapAtWord = wrap !== CHAR && shouldWrap,
      shouldAddEllipsis = this.ellipsis();

    this.textArr = [];
    getDummyContext().font = this._getContextFont();
    var additionalWidth = shouldAddEllipsis ? this._getTextWidth(ELLIPSIS) : 0;
    for (var i = 0, max = lines.length; i < max; ++i) {
      var line = lines[i];

      var lineWidth = this._getTextWidth(line);
      if (fixedWidth && lineWidth > maxWidth) {
        /*
         * if width is fixed and line does not fit entirely
         * break the line into multiple fitting lines
         */
        while (line.length > 0) {
          /*
           * use binary search to find the longest substring that
           * that would fit in the specified width
           */
          var low = 0,
            high = line.length,
            match = '',
            matchWidth = 0;
          while (low < high) {
            var mid = (low + high) >>> 1,
              substr = line.slice(0, mid + 1),
              substrWidth = this._getTextWidth(substr) + additionalWidth;
            if (substrWidth <= maxWidth) {
              low = mid + 1;
              match = substr;
              matchWidth = substrWidth;
            } else {
              high = mid;
            }
          }
          /*
           * 'low' is now the index of the substring end
           * 'match' is the substring
           * 'matchWidth' is the substring width in px
           */
          if (match) {
            // a fitting substring was found
            if (wrapAtWord) {
              // try to find a space or dash where wrapping could be done
              var wrapIndex;
              var nextChar = line[match.length];
              var nextIsSpaceOrDash = nextChar === SPACE || nextChar === DASH;
              if (nextIsSpaceOrDash && matchWidth <= maxWidth) {
                wrapIndex = match.length;
              } else {
                wrapIndex =
                  Math.max(match.lastIndexOf(SPACE), match.lastIndexOf(DASH)) +
                  1;
              }
              if (wrapIndex > 0) {
                // re-cut the substring found at the space/dash position
                low = wrapIndex;
                match = match.slice(0, low);
                matchWidth = this._getTextWidth(match);
              }
            }
            // if (align === 'right') {
            match = match.trimRight();
            // }
            this._addTextLine(match);
            textWidth = Math.max(textWidth, matchWidth);
            currentHeightPx += lineHeightPx;

            var shouldHandleEllipsis =
              this._shouldHandleEllipsis(currentHeightPx);
            if (shouldHandleEllipsis) {
              this._tryToAddEllipsisToLastLine();
              /*
               * stop wrapping if wrapping is disabled or if adding
               * one more line would overflow the fixed height
               */
              break;
            }
            line = line.slice(low);
            line = line.trimLeft();
            if (line.length > 0) {
              // Check if the remaining text would fit on one line
              lineWidth = this._getTextWidth(line);
              if (lineWidth <= maxWidth) {
                // if it does, add the line and break out of the loop
                this._addTextLine(line);
                currentHeightPx += lineHeightPx;
                textWidth = Math.max(textWidth, lineWidth);
                break;
              }
            }
          } else {
            // not even one character could fit in the element, abort
            break;
          }
        }
      } else {
        // element width is automatically adjusted to max line width
        this._addTextLine(line);
        currentHeightPx += lineHeightPx;
        textWidth = Math.max(textWidth, lineWidth);
        if (this._shouldHandleEllipsis(currentHeightPx) && i < max - 1) {
          this._tryToAddEllipsisToLastLine();
        }
      }
      // if element height is fixed, abort if adding one more line would overflow
      if (this.textArr[this.textArr.length - 1]) {
        this.textArr[this.textArr.length - 1].lastInParagraph = true;
      }
      if (fixedHeight && currentHeightPx + lineHeightPx > maxHeightPx) {
        break;
      }
    }
    this.textHeight = fontSize;
    // var maxTextWidth = 0;
    // for(var j = 0; j < this.textArr.length; j++) {
    //     maxTextWidth = Math.max(maxTextWidth, this.textArr[j].width);
    // }
    this.textWidth = textWidth;
  }

  /**
   * whether to handle ellipsis, there are two cases:
   * 1. the current line is the last line
   * 2. wrap is NONE
   * @param {Number} currentHeightPx
   * @returns
   */
  _shouldHandleEllipsis(currentHeightPx: number): boolean {
    var fontSize = +this.fontSize(),
      lineHeightPx = this.lineHeight() * fontSize,
      height = this.attrs.height,
      fixedHeight = height !== AUTO && height !== undefined,
      padding = this.padding(),
      maxHeightPx = height - padding * 2,
      wrap = this.wrap(),
      shouldWrap = wrap !== NONE;

    return (
      !shouldWrap ||
      (fixedHeight && currentHeightPx + lineHeightPx > maxHeightPx)
    );
  }

  _tryToAddEllipsisToLastLine(): void {
    var width = this.attrs.width,
      fixedWidth = width !== AUTO && width !== undefined,
      padding = this.padding(),
      maxWidth = width - padding * 2,
      shouldAddEllipsis = this.ellipsis();

    var lastLine = this.textArr[this.textArr.length - 1];
    if (!lastLine || !shouldAddEllipsis) {
      return;
    }

    if (fixedWidth) {
      var haveSpace = this._getTextWidth(lastLine.text + ELLIPSIS) < maxWidth;
      if (!haveSpace) {
        lastLine.text = lastLine.text.slice(0, lastLine.text.length - 3);
      }
    }

    this.textArr.splice(this.textArr.length - 1, 1);
    this._addTextLine(lastLine.text + ELLIPSIS);
  }

  // for text we can't disable stroke scaling
  // if we do, the result will be unexpected
  getStrokeScaleEnabled() {
    return true;
  }

  fontFamily: GetSet<string, this>;
  fontSize: GetSet<number, this>;
  fontStyle: GetSet<string, this>;
  fontVariant: GetSet<string, this>;
  align: GetSet<string, this>;
  letterSpacing: GetSet<number, this>;
  verticalAlign: GetSet<string, this>;
  padding: GetSet<number, this>;
  lineHeight: GetSet<number, this>;
  textDecoration: GetSet<string, this>;
  text: GetSet<string, this>;
  wrap: GetSet<string, this>;
  ellipsis: GetSet<boolean, this>;
}

Text.prototype._fillFunc = _fillFunc;
Text.prototype._strokeFunc = _strokeFunc;
Text.prototype.className = TEXT_UPPER;
Text.prototype._attrsAffectingSize = [
  'text',
  'fontSize',
  'padding',
  'wrap',
  'lineHeight',
  'letterSpacing',
];
_registerNode(Text);

/**
 * get/set width of text area, which includes padding.
 * @name Konva.Text#width
 * @method
 * @param {Number} width
 * @returns {Number}
 * @example
 * // get width
 * var width = text.width();
 *
 * // set width
 * text.width(20);
 *
 * // set to auto
 * text.width('auto');
 * text.width() // will return calculated width, and not "auto"
 */
Factory.overWriteSetter(Text, 'width', getNumberOrAutoValidator());

/**
 * get/set the height of the text area, which takes into account multi-line text, line heights, and padding.
 * @name Konva.Text#height
 * @method
 * @param {Number} height
 * @returns {Number}
 * @example
 * // get height
 * var height = text.height();
 *
 * // set height
 * text.height(20);
 *
 * // set to auto
 * text.height('auto');
 * text.height() // will return calculated height, and not "auto"
 */

Factory.overWriteSetter(Text, 'height', getNumberOrAutoValidator());

/**
 * get/set font family
 * @name Konva.Text#fontFamily
 * @method
 * @param {String} fontFamily
 * @returns {String}
 * @example
 * // get font family
 * var fontFamily = text.fontFamily();
 *
 * // set font family
 * text.fontFamily('Arial');
 */
Factory.addGetterSetter(Text, 'fontFamily', 'Arial');

/**
 * get/set font size in pixels
 * @name Konva.Text#fontSize
 * @method
 * @param {Number} fontSize
 * @returns {Number}
 * @example
 * // get font size
 * var fontSize = text.fontSize();
 *
 * // set font size to 22px
 * text.fontSize(22);
 */
Factory.addGetterSetter(Text, 'fontSize', 12, getNumberValidator());

/**
 * get/set font style.  Can be 'normal', 'italic', or 'bold' or even 'italic bold'.  'normal' is the default.
 * @name Konva.Text#fontStyle
 * @method
 * @param {String} fontStyle
 * @returns {String}
 * @example
 * // get font style
 * var fontStyle = text.fontStyle();
 *
 * // set font style
 * text.fontStyle('bold');
 */

Factory.addGetterSetter(Text, 'fontStyle', NORMAL);

/**
 * get/set font variant.  Can be 'normal' or 'small-caps'.  'normal' is the default.
 * @name Konva.Text#fontVariant
 * @method
 * @param {String} fontVariant
 * @returns {String}
 * @example
 * // get font variant
 * var fontVariant = text.fontVariant();
 *
 * // set font variant
 * text.fontVariant('small-caps');
 */

Factory.addGetterSetter(Text, 'fontVariant', NORMAL);

/**
 * get/set padding
 * @name Konva.Text#padding
 * @method
 * @param {Number} padding
 * @returns {Number}
 * @example
 * // get padding
 * var padding = text.padding();
 *
 * // set padding to 10 pixels
 * text.padding(10);
 */

Factory.addGetterSetter(Text, 'padding', 0, getNumberValidator());

/**
 * get/set horizontal align of text.  Can be 'left', 'center', 'right' or 'justify'
 * @name Konva.Text#align
 * @method
 * @param {String} align
 * @returns {String}
 * @example
 * // get text align
 * var align = text.align();
 *
 * // center text
 * text.align('center');
 *
 * // align text to right
 * text.align('right');
 */

Factory.addGetterSetter(Text, 'align', LEFT);

/**
 * get/set vertical align of text.  Can be 'top', 'middle', 'bottom'.
 * @name Konva.Text#verticalAlign
 * @method
 * @param {String} verticalAlign
 * @returns {String}
 * @example
 * // get text vertical align
 * var verticalAlign = text.verticalAlign();
 *
 * // center text
 * text.verticalAlign('middle');
 */

Factory.addGetterSetter(Text, 'verticalAlign', TOP);

/**
 * get/set line height.  The default is 1.
 * @name Konva.Text#lineHeight
 * @method
 * @param {Number} lineHeight
 * @returns {Number}
 * @example
 * // get line height
 * var lineHeight = text.lineHeight();
 *
 * // set the line height
 * text.lineHeight(2);
 */

Factory.addGetterSetter(Text, 'lineHeight', 1, getNumberValidator());

/**
 * get/set wrap.  Can be "word", "char", or "none". Default is "word".
 * In "word" wrapping any word still can be wrapped if it can't be placed in the required width
 * without breaks.
 * @name Konva.Text#wrap
 * @method
 * @param {String} wrap
 * @returns {String}
 * @example
 * // get wrap
 * var wrap = text.wrap();
 *
 * // set wrap
 * text.wrap('word');
 */

Factory.addGetterSetter(Text, 'wrap', WORD);

/**
 * get/set ellipsis. Can be true or false. Default is false. If ellipses is true,
 * Konva will add "..." at the end of the text if it doesn't have enough space to write characters.
 * That is possible only when you limit both width and height of the text
 * @name Konva.Text#ellipsis
 * @method
 * @param {Boolean} ellipsis
 * @returns {Boolean}
 * @example
 * // get ellipsis param, returns true or false
 * var ellipsis = text.ellipsis();
 *
 * // set ellipsis
 * text.ellipsis(true);
 */

Factory.addGetterSetter(Text, 'ellipsis', false, getBooleanValidator());

/**
 * set letter spacing property. Default value is 0.
 * @name Konva.Text#letterSpacing
 * @method
 * @param {Number} letterSpacing
 */

Factory.addGetterSetter(Text, 'letterSpacing', 0, getNumberValidator());

/**
 * get/set text
 * @name Konva.Text#text
 * @method
 * @param {String} text
 * @returns {String}
 * @example
 * // get text
 * var text = text.text();
 *
 * // set text
 * text.text('Hello world!');
 */

Factory.addGetterSetter(Text, 'text', '', getStringValidator());

/**
 * get/set text decoration of a text.  Possible values are 'underline', 'line-through' or combination of these values separated by space
 * @name Konva.Text#textDecoration
 * @method
 * @param {String} textDecoration
 * @returns {String}
 * @example
 * // get text decoration
 * var textDecoration = text.textDecoration();
 *
 * // underline text
 * text.textDecoration('underline');
 *
 * // strike text
 * text.textDecoration('line-through');
 *
 * // underline and strike text
 * text.textDecoration('underline line-through');
 */

Factory.addGetterSetter(Text, 'textDecoration', '');
