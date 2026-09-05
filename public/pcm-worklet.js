class PCMProcessor extends AudioWorkletProcessor {
 constructor(){super();this.samples=[];}
 process(inputs){const channel=inputs[0]?.[0];if(channel){for(const value of channel)this.samples.push(Math.max(-1,Math.min(1,value)));if(this.samples.length>=2048){const pcm=new Int16Array(this.samples.length);for(let i=0;i<pcm.length;i++)pcm[i]=this.samples[i]<0?this.samples[i]*32768:this.samples[i]*32767;this.port.postMessage(pcm.buffer,[pcm.buffer]);this.samples=[];}}return true;}
}
registerProcessor('pcm-processor',PCMProcessor);
