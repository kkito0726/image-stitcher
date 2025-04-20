import React from 'react'
import { useState } from 'react';
import { ImgLoader } from './ImgLoader';
import "./FileReader.css"
import ImageLogo from "./fileImage.png"


export const FileReader = () => {

    const [loading, setloading] = useState(false)
    const [path, setpath] = useState([])
    const [dataUrl, setDataUrl] = useState([])

    const onInput = (e) => {
        const file = e.target.files
        if (file && file.length > 0) {
            let dataURLs = []
            let filesPath = []

            for (let i=0; i<file.length; i++) {
                filesPath.push(window.URL.createObjectURL(file[i]))
                
                var reader = new window.FileReader();
                reader.readAsDataURL(file[i]);

                reader.onload = (e) => {
                    let str = e.target.result
                    dataURLs.push(str.substr(str.indexOf(",")+1))
                };  
            };
            setDataUrl(dataURLs);
            setpath(filesPath)
            return setloading(true); 
        }
    }

    return (
        <div className="outerBox">
            <div className="title">
            <div className='appTitle'>
                 <h1>パノラマ合成アプリ ~Stitching App~</h1>
                 <h2>~localhostへ接続~</h2>
            </div>
           
            
            </div>
            <div className="imageUplodeBox" id='uploadBox'>
                <h2>1. フォルダから画像を選択</h2>
                <div className="imageLogoAndText">
                    <p>JpegかPngの画像ファイル</p>
                    <img src={ImageLogo} alt="imagelogo" />
                    <p>ここにドラッグ＆ドロップ</p>
                </div>
                    <input 
                        className="imageUploadInput" 
                        multiple 
                        name="imageURL"  
                        type="file" 
                        accept=".png, .jpeg, .jpg"
                        onInput={onInput}
                    />
                    <p>または</p>
                    <button variant="contained" className='button'>
                        画像ファイルを選択
                        <input 
                            className="imageUploadInput" 
                            type="file"
                            accept=".png, .jpeg, .jpg, .tif, .bmp"
                            multiple
                            onInput={onInput}
                        />
                    </button>
            </div>
            {loading ? (
                <div>
                    <ImgLoader path={path} image={dataUrl} />
                </div>
                ) : (<></>)}
            <button
            type='button'
            onClick={() => {window.location.reload()}}
            className="button"
            id='refresh'
            >
                はじめからやり直す
            </button>
        </div>
    )
};

export default FileReader;
