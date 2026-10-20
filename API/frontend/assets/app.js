'use strict';
// No credentials, prices, bookings or payment states are trusted from localStorage.
const API='/api/v1';
const $=(id)=>document.getElementById(id);
const state={tours:[],filter:'all',user:null,query:'',region:'',budget:'',favorites:new Set()};
const money=n=>new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(n);
const day=x=>new Date(x).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
const el=(tag,attrs={},text)=>{const n=document.createElement(tag);for(const [k,v] of Object.entries(attrs)){if(k==='class')n.className=v;else n.setAttribute(k,v)}if(text!==undefined)n.textContent=text;return n};
function notify(s){$('notice').textContent=s;$('notice').style.display='block';clearTimeout(notify.t);notify.t=setTimeout(()=>$('notice').style.display='none',4500)}
function csrf(){const row=document.cookie.split('; ').find(s=>s.startsWith('delta_csrf='));return row?decodeURIComponent(row.split('=').slice(1).join('=')):''}
async function api(path,method='GET',body=null,extra={}){
 const headers={'Accept':'application/json',...extra};
 if(body!==null)headers['Content-Type']='application/json';
 if(!['GET','HEAD'].includes(method) && csrf())headers['X-CSRF-Token']=csrf();
 let res;
 try{res=await fetch(API+path,{method,headers,body:body===null?undefined:JSON.stringify(body),credentials:'same-origin'});}catch{throw new Error('Không thể kết nối tới máy chủ. Kiểm tra kết nối mạng.')}
 let result;try{result=await res.json()}catch{throw new Error('Máy chủ trả về dữ liệu không hợp lệ.')}
 if(!res.ok){let msg=result.detail||'Yêu cầu thất bại';if(Array.isArray(msg))msg=msg.map(x=>x.msg).join('; ');throw new Error(msg)}
 return result;
}
function modal(title,render){$('modalTitle').textContent=title;$('modalBody').replaceChildren();render($('modalBody'));if(!$('modal').open)$('modal').showModal()}
function close(){ $('modal').close() }
function text(parent,tag,value,cls=''){const x=el(tag,cls?{class:cls}:{},value);parent.append(x);return x}
function button(label,callback,cls='solid'){const b=el('button',{type:'button',class:cls},label);b.addEventListener('click',callback);return b}
function input(parent,label,name,type='text',attrs={}){const wrap=el('label',{class:'form-label'},label);const item=el('input',{class:'full-input',name,type,required:'required',...attrs});wrap.append(item);parent.append(wrap);return item}
function setUser(user){state.user=user;if(!user)state.favorites.clear();$('loginOpen').hidden=!!user;$('adminOpen').hidden=!(user&&user.role==='ADMIN');$('userMenu').hidden=!user;$('welcome').textContent=user?'Xin chào, '+user.fullName.split(' ').at(-1):'';}
async function syncUser(){try{setUser(await api('/auth/me'));await loadFavorites()}catch{setUser(null)}}
async function loadFavorites(){if(!state.user)return;state.favorites=new Set(await api('/favorites'));renderTours()}
async function loadTours(){try{state.tours=await api('/tours');renderTours()}catch(e){notify(e.message);$('count').textContent='Không tải được dữ liệu tour'}}
function renderTours(){
 const list=state.tours.filter(t=>{
  if(state.filter==='flash' && !t.isFlashSale)return false;
  if(['north','central','south'].includes(state.filter)&&t.region!==state.filter)return false;
  if(state.region&&t.region!==state.region)return false;
  if(state.budget&&t.price>Number(state.budget))return false;
  if(state.query&&!t.title.toLocaleLowerCase('vi').includes(state.query.toLocaleLowerCase('vi'))&&!t.departure.toLocaleLowerCase('vi').includes(state.query.toLocaleLowerCase('vi')))return false;
  return true;
 });
 $('cards').replaceChildren();$('count').textContent=`Hiển thị ${list.length} / ${state.tours.length} tour`;$('empty').hidden=!!list.length;
 for(const t of list){
  const card=el('article',{class:'tour-card'});const img=el('img',{class:'tour-img',alt:t.title,loading:'lazy'});
  if(/^https:\/\/(?:raw\.githubusercontent\.com)\//.test(t.image))img.src=t.image;
  card.append(img);const b=el('div',{class:'tour-text'});
  const tag=el('span',{class:'tag'},t.isFlashSale?'⚡ Flash Sale':'Điểm đến Việt Nam');b.append(tag);
  text(b,'h3',t.title);text(b,'div','📍 '+({north:'Miền Bắc',central:'Miền Trung',south:'Miền Nam'}[t.region]||t.region),'details');
  text(b,'div','🕒 '+t.duration+'　🚍 '+t.transport,'details');
  const prices=el('div',{class:'prices'});text(prices,'s',money(t.originalPrice));text(prices,'strong',money(t.price));b.append(prices);
  const actions=el('div',{class:'tour-actions'});
  actions.append(button('Xem lịch trình',()=>showTour(t),'outline'),button('🛒 Đặt ngay',()=>openBooking(t)));
  actions.append(button(state.favorites.has(t.id)?'♥':'♡',async()=>{if(!state.user){authForm();return}try{await api('/favorites/'+encodeURIComponent(t.id),state.favorites.has(t.id)?'DELETE':'POST',{});await loadFavorites();notify('Đã cập nhật danh sách yêu thích.')}catch(e){notify(e.message)}},'outline'));
  b.append(actions);card.append(b);$('cards').append(card);
 }
}
function showTour(t){modal(t.title,root=>{
 text(root,'p','Mã tour: '+t.id+' · '+t.duration,'muted');text(root,'p','Điểm đón: '+t.departure);text(root,'p','Phương tiện: '+t.transport);
 text(root,'p',t.description||'Chi tiết lịch trình đang được nhóm nội dung hoàn thiện.');
 text(root,'h3','Giá tham khảo: '+money(t.price));
 text(root,'p','Lịch trình ngày và chính sách bao gồm đang chờ quản trị viên nhập vào database. Không tự suy diễn từ nội dung quảng cáo.','muted');
 root.append(button('Kiểm tra lịch & đặt chỗ',()=>openBooking(t)));
})}
async function authForm(mode='login'){
 modal(mode==='register'?'Đăng ký tài khoản':'Đăng nhập Delta Travel',root=>{
  const form=el('form');let n,p;
  if(mode==='register')n=input(form,'Họ và tên','full_name','text',{minlength:'2',maxlength:'120',autocomplete:'name'});
  const email=input(form,'Email','email','email',{autocomplete:'email'});
  if(mode==='register')p=input(form,'Số điện thoại','phone','tel',{pattern:'0[35789][0-9]{8}',placeholder:'0912345678'});
  const pass=input(form,'Mật khẩu'+(mode==='register'?' (ít nhất 12 ký tự)':''),'password','password',{minlength:mode==='register'?'12':'1',autocomplete:mode==='register'?'new-password':'current-password'});
  form.append(button(mode==='register'?'Tạo tài khoản':'Đăng nhập',()=>form.requestSubmit(),'solid'));
  form.append(button(mode==='register'?'Đã có tài khoản? Đăng nhập':'Chưa có tài khoản? Đăng ký',()=>authForm(mode==='login'?'register':'login'),'outline'));
  form.addEventListener('submit',async ev=>{ev.preventDefault();const data=mode==='register'?{full_name:n.value,email:email.value,phone:p.value,password:pass.value}:{email:email.value,password:pass.value};
    try{const u=await api('/auth/'+(mode==='register'?'register':'login'),'POST',data);setUser(u);await loadFavorites();close();notify('Đã đăng nhập thành công!')}catch(e){notify(e.message)}
  });
  root.append(form);
 });
}
async function openBooking(t){
 try{
  const schedules=await api('/tours/'+encodeURIComponent(t.id)+'/schedules');
  modal('Đặt chỗ: '+t.title,root=>{
   text(root,'p','Thanh toán tự động chưa được kích hoạt. Đặt chỗ sẽ ở trạng thái CHỜ THANH TOÁN trong 15 phút.','muted');
   if(!state.user){text(root,'p','Vui lòng đăng nhập để đặt chỗ.');root.append(button('Đăng nhập',()=>authForm()));return}
   if(!schedules.length){text(root,'p','Chưa có lịch khởi hành. Vui lòng quay lại sau.');return}
   const form=el('form');const select=el('select',{class:'full-input',required:'required'});
   for(const s of schedules){const opt=el('option',{value:s.id},day(s.departureAt)+' · còn '+s.availableSeats+' chỗ');opt.disabled=s.availableSeats===0;select.append(opt)}
   text(form,'label','Chọn ngày khởi hành','form-label');form.append(select);
   const grid=el('div',{class:'form-grid'});
   const adults=input(grid,'Người lớn','adults','number',{min:'1',max:'20',value:'1'});
   const children=input(grid,'Trẻ em (75%)','children','number',{min:'0',max:'20',value:'0'});
   const infants=input(grid,'Em bé (10%)','infants','number',{min:'0',max:'20',value:'0'});
   form.append(grid);
   const name=input(form,'Tên người liên hệ','customer_name','text',{value:state.user.fullName});
   const phone=input(form,'Số điện thoại','customer_phone','tel',{value:state.user.phone,pattern:'0[35789][0-9]{8}'});
   const email=input(form,'Email','customer_email','email',{value:state.user.email});
   const note=input(form,'Ghi chú (nếu có)','note','text',{required:null,maxlength:'500'});note.removeAttribute('required');
   const total=text(form,'p','Báo giá được tính từ máy chủ khi chọn số khách.','sale');
   const refresh=async()=>{try{const q=await api('/bookings/quote','POST',{schedule_id:select.value,adults:Number(adults.value),children:Number(children.value),infants:Number(infants.value)});
     total.textContent='Tổng tiền: '+money(q.totalPrice)+' · còn '+q.availableSeats+' chỗ';
     }catch(e){total.textContent=e.message}};
   for(const field of [select,adults,children,infants])field.addEventListener('change',refresh);
   form.append(button('Giữ chỗ 15 phút',()=>form.requestSubmit(),'cta'));
   form.addEventListener('submit',async(ev)=>{
    ev.preventDefault();const data={schedule_id:select.value,adults:Number(adults.value),children:Number(children.value),infants:Number(infants.value),customer_name:name.value,customer_phone:phone.value,customer_email:email.value,note:note.value};
    const idem=crypto.randomUUID();try{const b=await api('/bookings','POST',data,{'Idempotency-Key':idem});
      close();notify('Đã giữ chỗ. Chưa thanh toán, mã đơn '+b.reference);openOrders();
    }catch(e){notify(e.message)}
   });root.append(form);refresh();
  });
 }catch(e){notify(e.message)}
}
async function openOrders(){
 if(!state.user){authForm();return}
 try{const bookings=await api('/bookings');modal('Đơn đặt chỗ của tôi',root=>{
  if(!bookings.length){text(root,'p','Chưa có đơn đặt chỗ.');return}
  for(const b of bookings){const row=el('div',{class:'booking-row'});text(row,'strong',b.tourTitle);text(row,'span','Mã: '+b.reference+'　'+money(b.totalPrice));
   text(row,'p','Trạng thái: '+b.status+' · '+(b.paid?'Đã xác minh':'Chưa xác minh thanh toán'),'muted');
   if(b.status==='PENDING_PAYMENT'){
    text(row,'small','Hạn giữ chỗ: '+day(b.expiresAt));row.append(button('Hủy giữ chỗ',async()=>{
       try{await api('/bookings/'+encodeURIComponent(b.id)+'/cancel','POST',{});notify('Đã hủy đơn');openOrders()}
       catch(e){notify(e.message)}},'outline'));
   }root.append(row)}
 });}catch(e){notify(e.message)}
}

async function openAdmin(){
 if(!state.user||state.user.role!=='ADMIN'){notify('Chỉ quản trị viên.');return}
 try{
  const [metrics,orders,tours,schedules]=await Promise.all([api('/admin/metrics'),api('/admin/bookings'),api('/admin/tours'),api('/admin/schedules')]);
  modal('Quản trị Delta Travel',root=>{
   text(root,'p',`Tài khoản: ${metrics.users} · Tour: ${metrics.tours} · Đơn: ${orders.length}`,'muted');
   text(root,'h3','Đơn chờ thanh toán');
   const waiting=orders.filter(o=>o.status==='PENDING_PAYMENT');
   if(!waiting.length)text(root,'p','Không có đơn chờ.');
   for(const b of waiting){const row=el('div',{class:'booking-row'});
    text(row,'strong',b.reference+' · '+money(b.totalPrice));
    text(row,'p',b.customerName+' · '+b.customerEmail+' · '+b.customerPhone);
    text(row,'p','Hết hạn: '+day(b.expiresAt)+' · Chưa thanh toán','muted');
    row.append(button('Xác minh chuyển khoản thủ công',async()=>{
     const ref=prompt('CHỈ nhập mã giao dịch sau khi đã đối chiếu ngân hàng thực tế. Nhập mã chứng từ giao dịch:');
     if(!ref)return;
     if(!confirm('Bạn xác nhận đã đối chiếu chính xác số tiền, mã đơn, tài khoản nhận và ngân hàng?'))return;
     try{await api('/admin/bookings/'+encodeURIComponent(b.id)+'/confirm-payment','POST',{reference:ref});notify('Đã ghi nhận xác minh thủ công.');openAdmin()}
     catch(e){notify(e.message)}
    }));root.append(row)}
   text(root,'h3','Giá tour (VND)');
   for(const t of tours){const row=el('div',{class:'calendar-row'});text(row,'span',t.id+' · '+t.title+' · '+money(t.price));
    row.append(button('Sửa giá',async()=>{
     const price=prompt('Giá VND mới (số nguyên dương):',String(t.price));
     if(price===null)return;
     if(!/^\d+$/.test(price)||Number(price)<1){notify('Giá không hợp lệ.');return}
     try{await api('/admin/tours/'+encodeURIComponent(t.id),'PATCH',{price:Number(price)});notify('Đã cập nhật giá ở máy chủ.');await loadTours();openAdmin()}
     catch(e){notify(e.message)}
    },'outline'));root.append(row)}
   text(root,'h3','Tồn chỗ theo lịch');
   for(const s of schedules.filter(s=>s.active&&new Date(s.departureAt)>new Date()).slice(0,30)){
    const row=el('div',{class:'calendar-row'});
    text(row,'span',s.tourId+' · '+day(s.departureAt)+' · '+s.availableSeats+'/'+s.totalSeats+' chỗ trống');
    row.append(button('Sửa sức chứa',async()=>{
     const total=prompt('Tổng số chỗ mới:',String(s.totalSeats));if(total===null)return;
     if(!/^\d+$/.test(total)||Number(total)<1){notify('Số chỗ không hợp lệ.');return}
     try{await api('/admin/schedules/'+encodeURIComponent(s.id),'PATCH',{total_seats:Number(total)});notify('Đã cập nhật tồn chỗ.');openAdmin()}
     catch(e){notify(e.message)}
    },'outline'));root.append(row)}
  });
 }catch(e){notify(e.message)}
}

function openFavorites(){
 if(!state.user){authForm();return}
 modal('Tour yêu thích',root=>{
  const saved=state.tours.filter(t=>state.favorites.has(t.id));
  if(!saved.length)text(root,'p','Bạn chưa lưu tour nào.');
  for(const t of saved){const item=el('div',{class:'calendar-row'});text(item,'span',t.title+' · '+money(t.price));item.append(button('Đặt ngay',()=>openBooking(t)));root.append(item)}
 });
}
function openProfile(){
 if(!state.user){authForm();return}
 modal('Cập nhật hồ sơ',root=>{
  const form=el('form');text(form,'p','Email đăng nhập: '+state.user.email,'muted');
  const name=input(form,'Họ tên','full_name','text',{value:state.user.fullName});
  const phone=input(form,'Số điện thoại','phone','tel',{value:state.user.phone,pattern:'0[35789][0-9]{8}'});
  form.append(button('Lưu thông tin',()=>form.requestSubmit()));
  form.addEventListener('submit',async e=>{e.preventDefault();try{setUser(await api('/auth/profile','PATCH',{full_name:name.value,phone:phone.value}));notify('Đã cập nhật hồ sơ trên máy chủ.');close()}catch(err){notify(err.message)}});
  root.append(form);
 });
}
function startChat(){const p=$('chatPanel');p.hidden=!p.hidden}
$('botToggle').addEventListener('click',startChat);$('chatClose').addEventListener('click',startChat);
$('chatForm').addEventListener('submit',async e=>{e.preventDefault();const inp=$('chatInput');const message=inp.value.trim();if(!message)return;inp.value='';text($('chatMessages'),'p','Bạn: '+message);
 try{const reply=await api('/assistant/chat','POST',{message});text($('chatMessages'),'p','Delta: '+reply.answer)}catch(err){text($('chatMessages'),'p','Lỗi: '+err.message)}});
$('closeModal').addEventListener('click',close);
$('modal').addEventListener('click',e=>{if(e.target===$('modal'))close()});
$('profileOpen').addEventListener('click',openProfile);$('favoritesOpen').addEventListener('click',openFavorites);$('adminOpen').addEventListener('click',openAdmin);$('loginOpen').addEventListener('click',()=>authForm());$('myOrders').addEventListener('click',openOrders);
$('logout').addEventListener('click',async()=>{try{await api('/auth/logout','POST',{});setUser(null);notify('Đã đăng xuất.')}catch(e){notify(e.message)}});
$('filters').addEventListener('click',e=>{const b=e.target.closest('[data-filter]');if(!b)return;state.filter=b.dataset.filter;
 $('filters').querySelectorAll('button').forEach(x=>x.classList.toggle('chosen',x===b));renderTours()});
$('flashLink').addEventListener('click',()=>{state.filter='flash';document.querySelector('[data-filter="flash"]').click()});
$('searchForm').addEventListener('submit',e=>{e.preventDefault();state.query=$('searchText').value.trim();state.region=$('region').value;state.budget=$('budget').value;renderTours();$('tours').scrollIntoView({behavior:'smooth'})});
(async()=>{await Promise.all([syncUser(),loadTours()]);setInterval(()=>{if(!document.hidden)loadTours()},30000)})();
