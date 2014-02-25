/*
 *Meow meow player v0.1.0- a music player built with HTML5 audio API =>_<=
 *Wayou Feb 21,2014
 *Lisenced under the MIT license
 *project page:
 *live demo:
 */
'use strict'
window.onload = function() {
    var player = new MmPlayer();
    player.ini();
}
var MmPlayer = function() {
    this.VERSION = '0.1.0',
    this.APP_NAME = 'Meowmeow Player',
    this.title = this.APP_NAME, //the app title on the top of the page, will upgrade when songs playing
    this.audioContext = null,
    this.source = null,
    this.playlist = [],
    this.currentOrderNum = 0, //orderNum starts from 0
    this.currentTime = 0, //when click pause, store the time where the song paused to resume play
    this.listContainer = document.getElementById('playlist'),
    this.status = 0, //1 for stopped and 1 for playing
    this.canvas = document.getElementById('canvas'),
    this.animationId = null,
    this.titleUpdateId = null
}
MmPlayer.prototype = {
    ini: function() {
        this._prepareAPI();
        this._startApp();
    },
    _prepareAPI: function() {
        //fix browser vender for AudioContext and requestAnimationFrame
        window.AudioContext = window.AudioContext || window.webkitAudioContext || window.mozAudioContext || window.msAudioContext;
        window.requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.msRequestAnimationFrame;
        window.cancelAnimationFrame = window.cancelAnimationFrame || window.webkitCancelAnimationFrame || window.mozCancelAnimationFrame || window.msCancelAnimationFrame;
        try {
            this.audioContext = new AudioContext();
        } catch (e) {
            this._updateTitle('!Your browser does not support AudioContext', false);
            console.log(e);
        }
    },
    _startApp: function() {
        var that = this,
            audioInput = document.getElementById('addFiles'),
            dropContainer = document.getElementsByTagName("canvas")[0],
            listContainer = document.getElementById('playlist');
        //listen the file upload
        audioInput.onchange = function() {
            if (that.audioContext === null) {
                return
            };
            //the if statement fixes the file selction cancle, because the onchange will trigger even the file selection been canceled
            if (audioInput.files.length !== 0) {
                that._updateTitle('Uploading', true);
                // var files = that._convertFileListToArray(audioInput.files);
                that.addToList(audioInput.files);
                that._getFilesAndRun(that.files);
            };
        };
        //listen the drag & drop
        dropContainer.addEventListener("dragenter", function() {
            that._updateTitle('Drop it on the page', true);
        }, false);
        dropContainer.addEventListener("dragover", function(e) {
            e.stopPropagation();
            e.preventDefault();
            //set the drop mode
            e.dataTransfer.dropEffect = 'copy';
        }, false);
        dropContainer.addEventListener("dragleave", function() {
            that._updateTitle(that.info, false);
        }, false);
        dropContainer.addEventListener("drop", function(e) {
            e.stopPropagation();
            e.preventDefault();
            if (that.audioContext === null) {
                return
            };
            that._updateTitle('Uploading', true);
            //get the dropped file
            that.addToList(e.dataTransfer.files);
            that._getFilesAndRun(that.files);
        }, false);
        //play selected entry from the playlist
        listContainer.addEventListener('click', function(e) {
            var target = e.target;
            if (e.target.className === 'title') {
                //play selected item
                var selectedIndex = that._getSlectedIndex(e.target);
                that.currentOrderNum = selectedIndex;
                that.play(selectedIndex);
            } else {
                if (e.target.className === 'remove') {
                    //remove selected item from list
                    var selectedIndex = that._getSlectedIndex(e.target);
                    that.removeFromList(selectedIndex, e.target.parentNode);
                };
            };
        });
    },
    _convertFileListToArray: function(files) {
        var result = [];
        for (var i = files.length - 1; i >= 0; i--) {
            result.push(files[i]);
        };
        return result;
    },
    _getFilesAndRun: function(files) {
        this.play(0); //first run, play the first song
    },
    play: function(orderNum, time) {
        if (time !== undefined && this.source !== null) {
            //resume play
            this.source.play(time);
        } else {
            this.currentOrderNum = orderNum;
            this._readFile(orderNum);
        };
    },
    _readFile: function(orderNum) { //read file as arraybuffer
        var that = this,
            playlist = this.playlist,
            file = playlist[orderNum],
            reader = new FileReader();
        reader.onload = function(e) {
            var arraybuffer = e.target.result;
            that._decodeFile(arraybuffer);
        };
        reader.onerror = function(e) {
            that._updateTitle('!Fail to read the file', false);
            console.log(e);
        };
        reader.readAsArrayBuffer(file);
    },
    _decodeFile: function(arraybuffer) {
        var that = this,
            audioContext = this.audioContext;
        if (audioContext === null) {
            return;
        };
        this._updateTitle('Decoding the audio', true);
        audioContext.decodeAudioData(arraybuffer, function(buffer) {
            that._updateTitle('Decode succussfully,start the visualizer', true);
            that._drawSpectrum(audioContext, buffer);
        }, function(e) {
            that._updateTitle('!Fail to decode the file', false);
            console.log(e);
        });
    },
    _drawSpectrum: function(audioCtx, buffer) {
        var that = this,
            source = audioCtx.createBufferSource(),
            analyser = audioCtx.createAnalyser(),
            canvas = this.canvas,
            canvasCtx = canvas.getContext('2d'),
            cwidth = canvas.width,
            cheight = canvas.height - 2,
            meterWidth = 10, //width of the meters in the spectrum
            gap = 2, //gap between meters
            capHeight = 2,
            capStyle = '#fff',
            meterNum = 800 / (10 + 2), //count of the meters
            capYPositionArray = [], ////store the vertical position of hte caps for the preivous frame
            gradient = canvasCtx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(1, '#0f0');
        gradient.addColorStop(0.5, '#ff0');
        gradient.addColorStop(0, '#f00');
        //setup the audio
        source.buffer = buffer;
        source.connect(analyser);
        analyser.connect(audioCtx.destination);
        if (this.source !== null) {
            this.source.stop(0);
            this.status = 0;
            cancelAnimationFrame(this.animationId);
        };
        source.start(0);
        this._updateTitle('Playing ' + this.playlist[this.currentOrderNum].name.slice(0, -4), false);
        this.source = source;
        this.status = 1;
        var drawFrame = function() {
            console.log('audio processing...');
            var array = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(array);
            //draw the visualizer stuff on the canvas
            var step = Math.round(array.length / meterNum); //sample limited data from the total array
            canvasCtx.clearRect(0, 0, cwidth, cheight);
            for (var i = 0; i < meterNum; i++) {
                var value = array[i * step];
                if (capYPositionArray.length < Math.round(meterNum)) {
                    capYPositionArray.push(value);
                };
                canvasCtx.fillStyle = capStyle;
                //draw the cap, with transition effect
                if (value < capYPositionArray[i]) {
                    canvasCtx.fillRect(i * 12, cheight - (--capYPositionArray[i]), meterWidth, capHeight);
                } else {
                    canvasCtx.fillRect(i * 12, cheight - value, meterWidth, capHeight);
                    capYPositionArray[i] = value;
                };
                canvasCtx.fillStyle = gradient; //set the filllStyle to gradient for a better look
                canvasCtx.fillRect(i * 12 /*meterWidth+gap*/ , cheight - value + capHeight, meterWidth, cheight); //the meter
            }
            that.animationId = requestAnimationFrame(drawFrame);
        };
        that.animationId = requestAnimationFrame(drawFrame);
    },
    pause: function(time) {
        this.source.stop(time);
        this.status = 0;
    },
    stop: function() {
        this.source.stop(0);
        this.status = 0;
    },
    addToList: function(files) {
        var that = this,
            li,
            container = this.listContainer,
            docFragment = document.createDocumentFragment(); //use docfragment to improve the performance
        for (var i = files.length - 1; i >= 0; i--) {
            li = document.createElement("li");
            li.innerHTML = '<span class="remove" title="remove from list">X</span>' + '<span class="title">' + files[i].name.slice(0, -4) + '</span>';
            docFragment.appendChild(li);
            this.playlist.push(files[i]);
        };
        container.appendChild(docFragment); //add entries to the playlist
    },
    removeFromList: function(orderNum, targetEle) {
        this.playlist.splice(orderNum, 1); //remove the specified item from the list
        this.listContainer.removeChild(targetEle);
        if (this.playlist.length === 0) {
            this.source.stop(0);
            this.source = null;
            return;
        };
        if (orderNum === this.currentOrderNum) {
            this.play(this.currentOrderNum);
        };
    },
    shuffleList: function() {
        var that = this,
            lastIndex,
            container = this.listContainer;
        //TODO
    },
    _getSlectedIndex: function(target) {
        var li = target.parentNode,
            index = 0;
        this.addClass(li, 'currentItem');
        while (li.previousElementSibling) {
            li = li.previousElementSibling;
            index += 1;
        }
        return index;
    },
    _getLiIndex: function(li) {
        var childs = li.parentNode.childNodes;
        for (i = 0; i < childs.length; i++) {
            if (li == childs[i]) break;
        }
        return i;
    },
    _updateTitle: function(text, processing) {
        var infoBar = document.getElementsByTagName('header')[0],
            dots = '...',
            i = 0,
            that = this;
        infoBar.innerHTML = text + dots.substring(0, i++);
        if (this.titleUpdateId !== null) {
            clearTimeout(this.titleUpdateId);
        };
        if (processing) {
            //animate dots at the end of the info text
            var animateDot = function() {
                if (i > 3) {
                    i = 0
                };
                infoBar.innerHTML = text + dots.substring(0, i++);
                that.titleUpdateId = setTimeout(animateDot, 250);
            }
            this.titleUpdateId = setTimeout(animateDot, 250);
        };
    },
    addClass: function(el, cls) {
        //reference:http://stackoverflow.com/questions/6787383/what-is-the-solution-to-remove-add-a-class-in-pure-javascript
        el.className += ' ' + cls;
    },
    removeClass: function(el, cls) {
        var elClass = ' ' + el.className + ' ';
        while (elClass.indexOf(' ' + cls + ' ') != -1) elClass = elClass.replace(' ' + cls + ' ', '');
        el.className = elClass;
    }
}