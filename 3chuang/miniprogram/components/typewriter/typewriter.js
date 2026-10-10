/**
 * 打字机效果组件 (Typewriter)
 * 
 * AI 解释文字逐字显示，模拟 AI 实时生成的视觉效果
 * 带闪烁光标，打字完成后光标自动消失
 * 
 * Requirements: 8.7 - AI 解释打字机效果
 * 
 * Props:
 *   text {String} - 要显示的完整文字
 *   speed {Number} - 每个字符的显示间隔（ms），默认 50
 *   delay {Number} - 开始前的延迟（ms），默认 300
 */
Component({
  properties: {
    text: {
      type: String,
      value: '',
      observer: function(newVal) {
        if (newVal) {
          this.startTyping(newVal);
        }
      }
    },
    speed: {
      type: Number,
      value: 50
    },
    delay: {
      type: Number,
      value: 300
    }
  },

  data: {
    displayText: '',
    showCursor: false
  },

  lifetimes: {
    attached: function() {
      if (this.properties.text) {
        this.startTyping(this.properties.text);
      }
    },
    detached: function() {
      this.stopTyping();
    }
  },

  methods: {
    /**
     * 开始打字效果
     */
    startTyping: function(fullText) {
      this.stopTyping();

      if (!fullText || fullText.length === 0) {
        this.setData({ displayText: '', showCursor: false });
        return;
      }

      this._fullText = fullText;
      this._charIndex = 0;

      // 显示光标，延迟后开始打字
      this.setData({ displayText: '', showCursor: true });

      this._delayTimer = setTimeout(() => {
        this._typeNext();
      }, this.properties.delay);
    },

    /**
     * 逐字显示下一个字符
     */
    _typeNext: function() {
      if (this._charIndex >= this._fullText.length) {
        // 打字完成，延迟后隐藏光标
        this._cursorTimer = setTimeout(() => {
          this.setData({ showCursor: false });
          this.triggerEvent('complete');
        }, 1000);
        return;
      }

      this._charIndex++;
      const currentText = this._fullText.substring(0, this._charIndex);
      this.setData({ displayText: currentText });

      // 标点符号后稍作停顿，更自然
      let nextDelay = this.properties.speed;
      const currentChar = this._fullText[this._charIndex - 1];
      if ('，。！？、；：'.indexOf(currentChar) !== -1) {
        nextDelay = this.properties.speed * 3;
      } else if (',.!?;:'.indexOf(currentChar) !== -1) {
        nextDelay = this.properties.speed * 2;
      }

      this._typeTimer = setTimeout(() => {
        this._typeNext();
      }, nextDelay);
    },

    /**
     * 停止打字
     */
    stopTyping: function() {
      if (this._delayTimer) {
        clearTimeout(this._delayTimer);
        this._delayTimer = null;
      }
      if (this._typeTimer) {
        clearTimeout(this._typeTimer);
        this._typeTimer = null;
      }
      if (this._cursorTimer) {
        clearTimeout(this._cursorTimer);
        this._cursorTimer = null;
      }
    },

    /**
     * 立即显示全部文字（跳过动画）
     */
    skipToEnd: function() {
      this.stopTyping();
      if (this._fullText) {
        this.setData({
          displayText: this._fullText,
          showCursor: false
        });
        this.triggerEvent('complete');
      }
    }
  }
});
