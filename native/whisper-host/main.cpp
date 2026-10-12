#define NOMINMAX
#include <windows.h>
#include <fcntl.h>
#include <io.h>
#include <whisper.h>
#include <atomic>
#include <chrono>
#include <cmath>
#include <cstdio>
#include <filesystem>
#include <mutex>
#include <stdexcept>
#include <string>
#include <thread>
#include <vector>

using Clock=std::chrono::steady_clock;
static double elapsed(Clock::time_point t){return std::chrono::duration<double,std::milli>(Clock::now()-t).count();}
static std::mutex output;
static FILE* protocol=stdout;
static std::string quote(const std::string& s){std::string r="\"";for(unsigned char c:s){if(c=='"'||c=='\\'){r+='\\';r+=c;}else if(c<32){char b[7];sprintf_s(b,"\\u%04x",c);r+=b;}else r+=c;}return r+'"';}
static void emit(const std::string& s){std::lock_guard<std::mutex> lock(output);fwrite(s.data(),1,s.size(),protocol);fputc('\n',protocol);fflush(protocol);}
static void error(const std::string& s,uint32_t id=0){emit("{\"type\":\"error\",\"id\":"+std::to_string(id)+",\"error\":"+quote(s)+"}");}
template<class T> static T symbol(HMODULE dll,const char* name){auto p=GetProcAddress(dll,name);if(!p)throw std::runtime_error(std::string("Missing pinned ABI symbol: ")+name);return reinterpret_cast<T>(p);}
#define API(name) auto name=symbol<decltype(&::name)>(dll,#name)
static std::string utf8(const std::wstring& s){int n=WideCharToMultiByte(CP_UTF8,0,s.data(),(int)s.size(),nullptr,0,nullptr,nullptr);std::string r(n,0);WideCharToMultiByte(CP_UTF8,0,s.data(),(int)s.size(),r.data(),n,nullptr,nullptr);return r;}
static bool readExact(void* p,size_t n){return fread(p,1,n,stdin)==n;}
int wmain(int argc,wchar_t** argv){
 _setmode(_fileno(stdin),_O_BINARY);_setmode(_fileno(stdout),_O_BINARY);
 // Preserve the private protocol stream, route any native stdout logging to stderr.
 protocol=_fdopen(_dup(_fileno(stdout)),"wb");if(!protocol)return 1;
 _dup2(_fileno(stderr),_fileno(stdout));SetStdHandle(STD_OUTPUT_HANDLE,GetStdHandle(STD_ERROR_HANDLE));
 try{
 std::wstring runtime,model,backend;DWORD parent=0;
 for(int i=1;i<argc;i+=2){if(i+1>=argc)throw std::runtime_error("Missing argument value");std::wstring k=argv[i],v=argv[i+1];if(k==L"--runtime-dir")runtime=v;else if(k==L"--model")model=v;else if(k==L"--backend")backend=v;else if(k==L"--parent-pid")parent=std::stoul(v);else throw std::runtime_error("Unknown argument");}
 if(!std::filesystem::path(runtime).is_absolute()||!std::filesystem::path(model).is_absolute()||(backend!=L"cpu"&&backend!=L"cuda")||!parent)throw std::runtime_error("Required: --runtime-dir ABS --model ABS --backend cpu|cuda --parent-pid PID");
 HANDLE owner=OpenProcess(SYNCHRONIZE,FALSE,parent);if(!owner)throw std::runtime_error("Parent process unavailable");
 std::thread([owner]{WaitForSingleObject(owner,INFINITE);CloseHandle(owner);TerminateProcess(GetCurrentProcess(),0);}).detach();
 SetDefaultDllDirectories(LOAD_LIBRARY_SEARCH_SYSTEM32|LOAD_LIBRARY_SEARCH_USER_DIRS);
 if(!AddDllDirectory(runtime.c_str()))throw std::runtime_error("Cannot add runtime DLL directory");
 auto started=Clock::now();
 HMODULE dll=LoadLibraryExW((std::filesystem::path(runtime)/L"whisper.dll").c_str(),nullptr,LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR|LOAD_LIBRARY_SEARCH_DEFAULT_DIRS);
 if(!dll)throw std::runtime_error("Cannot load absolute whisper.dll: "+std::to_string(GetLastError()));
 double dllMs=elapsed(started);
 API(whisper_version);API(whisper_context_default_params);API(whisper_init_from_file_with_params_no_state);API(whisper_init_state);API(whisper_free_state);API(whisper_free);API(whisper_full_default_params);API(whisper_full_with_state);API(whisper_full_n_segments_from_state);API(whisper_full_get_segment_text_from_state);
 API(whisper_full_get_segment_no_speech_prob_from_state);
 if(std::string(whisper_version())!="1.8.2")throw std::runtime_error("whisper.dll version must be 1.8.2");
 auto cp=whisper_context_default_params();cp.use_gpu=backend==L"cuda";cp.flash_attn=true;
 auto t=Clock::now();auto ctx=whisper_init_from_file_with_params_no_state(utf8(model).c_str(),cp);double modelMs=elapsed(t);if(!ctx)throw std::runtime_error("Model initialization failed");
 t=Clock::now();auto state=whisper_init_state(ctx);double stateMs=elapsed(t);if(!state){whisper_free(ctx);throw std::runtime_error("State initialization failed");}
 emit("{\"type\":\"ready\",\"pid\":"+std::to_string(GetCurrentProcessId())+",\"metrics\":{\"dllLoadMs\":"+std::to_string(dllMs)+",\"modelLoadMs\":"+std::to_string(modelMs)+",\"backendInitMs\":"+std::to_string(stateMs)+",\"prepareMs\":"+std::to_string(elapsed(started))+"}}");
 std::atomic<bool> active{false},cancel{false};std::atomic<uint32_t> activeId{0};std::mutex lifecycle;std::thread worker;
 for(;;){uint32_t h[3];if(!readExact(h,sizeof(h)))break;uint32_t kind=h[0],id=h[1],count=h[2];
 if(kind==3&&count==0)break;
 if(kind==2&&count==0){std::lock_guard<std::mutex> l(lifecycle);if(active&&activeId==id)cancel=true;continue;}
 if(kind!=1||count<4800||count>320000){error("Invalid frame kind or sample count",id);break;}
 std::vector<float> pcm(count);if(!readExact(pcm.data(),count*sizeof(float))){error("Truncated PCM frame",id);break;}
 bool valid=true;for(float x:pcm)if(!std::isfinite(x)||x<-1.0f||x>1.0f){valid=false;break;}if(!valid){error("PCM must be finite and normalized",id);continue;}
 {std::lock_guard<std::mutex> l(lifecycle);if(active){error("Inference already active",id);continue;}}
 if(worker.joinable())worker.join();
 {std::lock_guard<std::mutex> l(lifecycle);cancel=false;activeId=id;active=true;}
 worker=std::thread([&,id,pcm=std::move(pcm)]{
 auto start=Clock::now();auto params=whisper_full_default_params(WHISPER_SAMPLING_BEAM_SEARCH);
 params.greedy.best_of=whisper_full_default_params(WHISPER_SAMPLING_GREEDY).greedy.best_of;
 params.n_threads=2;params.language="en";params.no_context=true;params.no_timestamps=true;
 params.print_realtime=false;params.print_progress=false;params.print_timestamps=false;params.suppress_nst=false;
 params.abort_callback=[](void* p){return static_cast<std::atomic<bool>*>(p)->load();};params.abort_callback_user_data=&cancel;
 params.encoder_begin_callback=[](whisper_context*,whisper_state*,void* p){return !static_cast<std::atomic<bool>*>(p)->load();};params.encoder_begin_callback_user_data=&cancel;
 int rc=cancel?1:whisper_full_with_state(ctx,state,params,pcm.data(),(int)pcm.size());std::string result;
 if(!rc&&!cancel)for(int i=0;i<whisper_full_n_segments_from_state(state);++i)if(whisper_full_get_segment_no_speech_prob_from_state(state,i)<0.6f)result+=whisper_full_get_segment_text_from_state(state,i);
 std::lock_guard<std::mutex> l(lifecycle);
 if(cancel)emit("{\"type\":\"cancelled\",\"id\":"+std::to_string(id)+"}");
 else if(rc)error("whisper_full failed: "+std::to_string(rc),id);
 else emit("{\"type\":\"result\",\"id\":"+std::to_string(id)+",\"text\":"+quote(result)+",\"metrics\":{\"inferenceMs\":"+std::to_string(elapsed(start))+",\"audioMs\":"+std::to_string(pcm.size()/16.0)+"}}");
 active=false;
 });
 }
 cancel=true;if(worker.joinable())worker.join();whisper_free_state(state);whisper_free(ctx);FreeLibrary(dll);return 0;
 }catch(const std::exception& e){error(e.what());return 1;}
}
