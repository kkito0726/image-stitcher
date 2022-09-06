import "./ImgSender.css"
import React from 'react'
import axios from 'axios'
import { useState, createContext } from 'react';
import { Link } from 'react-router-dom';
import { ImgCropper } from "./ImgCropper";

export const ImgURL = createContext()

export const ImgSender = ({image}) => {
    const [mode, setMode] = useState("Scans")
    const [isProcess, setIsProcess] = useState(false)
    const [status, setStatus] = useState({
        recieveData: null,
        isStitched: null,
        isRecieved: false
    });

    const initStatus = () => {
        setIsProcess(false);
        setStatus({
            recieveData: null,
            isStitched: null,
            isRecieved: false
        });
    };

    const sendPath = () => {
        initStatus();

        const url = "http://127.0.0.1:5000/stitch";
        const sendData = {
            mode: mode,
            image: image,
        }
        const config = {
            headers: {
                'content-type': 'multipart/form-data'
            }
        }
        setIsProcess(true)
        axios({
            method: "post",
            url: url,
            data: sendData,
            config: config
        }).then((res) => {
            setStatus({
                recieveData: res.data.base64Data,
                isStitched: res.data.isStitched,
                isRecieved: true
            })
            setIsProcess(false)
        }).catch((err) => {
            console.log(err)
        });
        
    }
    const handleChange = (e) => {
        setMode(e.target.value)
    }
    return (
    <div>
        <div className="imageUplodeBox">
            <h2>2. モードの選択</h2>
            <div className="descriptionBox">
                <ul className="modeList">
                    <li>スキャンモード: 顕微鏡写真など奥行きを考慮しなくて良いもの (アフィン投影)</li>
                    <li>パノラマモード: 風景の写真など奥行きがあるもの (球面投影)</li>
                </ul>
                <select name="mode" id="modeSelecter" onChange={handleChange}>
                    <option defaultValue="Scans" value="Scans">スキャンモード</option>
                    <option value="Panorama" >パノラマモード</option>
                </select><br />
            </div>
        </div>
        <button type='button' onClick={sendPath} className="button">
            読み込まれた画像とモードを確認してStitching
        </button>
        
        {(() => {
            if (isProcess) {
                return (
                    <div id="prog">
                        <label>処理中です: <progress></progress></label>
                    </div>
                    
                )
            }
        })()}

        {(() => {
            if (status.isRecieved && status.isStitched == 0) {
                return(
                    <div className='imageUplodeBox'>
                        <h2>3. 実行結果を確認して画像を保存する</h2>
                        {status.recieveData && <img src={`data:image/png;base64,${status.recieveData}`}  className="stitchedImg" style={{width: "640px"}}/>}<br/>
                        <Link to="/crop" state={`data:image/png;base64,${status.recieveData}`} className="button">トリミングする</Link>
                    </div> 
                ) 
            } else if (status.isRecieved && status.isStitched == 1) {
                return(
                    <div className='imageUplodeBox'>
                        <h2>重ね合わせられませんでした...</h2>
                        <div className="descriptionBox">
                            <h3>
                                パノラマ合成のコツ
                            </h3>
                            <p>
                                特徴点同士を合わせられず、エラーになりました。<br />
                                画像の重なり合う部分(のりしろ)を増やして写真を撮影しましょう!!
                            </p>
                        </div>
                        
                    </div>
                )
            }
        }) ()}
    </div>
    )
}