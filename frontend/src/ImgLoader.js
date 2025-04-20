import React from 'react'
import { ImgSender } from './ImgSender'
import { v4 as uuidv4 } from 'uuid'

export const ImgLoader = ({path, image}) => {

    const roadImgList = path.map((value) => <img src={value} className="readImg" key={uuidv4()} name="img" />)
    
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
