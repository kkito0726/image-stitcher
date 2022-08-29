import './App.css';
import FileReader from './FileReader';
import { BrowserRouter, Route, Routes, Link } from 'react-router-dom'
import {ImgCropper} from './ImgCropper';

const App = () => {
  return (
    <div>
      <BrowserRouter>
        <Routes>
          <Route path='/' element={<Home/>} />
          <Route path='/crop' element={<ImgCropper/>} />
        </Routes>
        
      </BrowserRouter>
    </div>
    
  );
};

const Home = () => {
  return(
    <div className="App">
      <FileReader />
    </div>
  );
};
export default App;
