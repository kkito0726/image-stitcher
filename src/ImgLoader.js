import React from 'react'
import { ImgSender } from './ImgSender'

export const ImgLoader = ({path, image}) => {

    const roadImgList = path.map((value, index) => <img src={value} className="readImg" key={index} name="img" />)
    
  return (
    <div>
      <div style={{marginTop: "30px"}}>
        <b>
          {roadImgList.length}枚の画像が読み込まれました
        </b>
        <p>{roadImgList}</p>
      </div>
      
      <form action="" name='img'>
        <ImgSender image={image}/>
      </form>
        
    </div>
    
  )
}
