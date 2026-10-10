import {defineConfig} from 'vite';
import base from './vite.config.js';
export default defineConfig({...base,server:{...base.server,host:'127.0.0.1',port:16773,strictPort:true,fs:{allow:['..']},proxy:{'/api':{target:'http://127.0.0.1:13473',changeOrigin:true,timeout:180000}}}});
