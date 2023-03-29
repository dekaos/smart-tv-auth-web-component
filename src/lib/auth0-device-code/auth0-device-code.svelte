<svelte:options tag="auth0-device-code" />
<script lang="ts">
  import { onMount, tick } from 'svelte';
  import store from 'store';
  
  interface Image {
    urls: { small: string }
  }

  interface Auth0DeviceCode {
    device_code: string,
    expires_in: number,
    interval: number,
    user_code: string,
    verification_uri: string,
    verification_uri_complete: string
  }

  interface UserInfo {
    given_name: string,
    picture: string,
  }
  
  interface Tokens {
    access_token: string,
    id_token: string,
    refresh_token: string
  }

  let dataImages:Image[] = [];
  let auth0Data: Auth0DeviceCode;
  let userInfo: UserInfo;
  let attemps: number = 0;
  
  let loading = false;
  let hasAccessToken = true;
  let fetchInterval: number | undefined;

  const {
    VITE_UNSPLASH_PHOTOS_URL,
    VITE_UNSPLASH_CLIENT_ID,
    VITE_REQUEST_AUTH0_CODE_URL,
    VITE_REQUEST_AUTH0_TOKEN_URL,
    VITE_AUTH0_USER_INFO_URL,
    VITE_AUTH0_USER_REFRESH_TOKEN_URL
  } = import.meta.env;

  const setTokens = (tokens: Tokens) => {
    if (!tokens || tokens && !Object.keys(tokens).length) return;

    (Object.keys(tokens) as (keyof typeof tokens)[]).forEach(key => {
      store.set(key, tokens[key]);
    })
  }

  const getSampleImages = async () => {
    const url = `${VITE_UNSPLASH_PHOTOS_URL}?client_id=${VITE_UNSPLASH_CLIENT_ID}&per_page=20`;
    const response = await fetch(url);
    dataImages = await response.json();
  }

  const tryRefreshToken = async () => {
    try {
      const refreshToken = store.get('refresh_token');

      if (!refreshToken) throw 'Invalid refresh token';
      
      const response = await fetch(VITE_AUTH0_USER_REFRESH_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({refresh_token: refreshToken}),
      });

      const data = await response.json();

      const { error, access_token, id_token } = data;

      if (error) throw new Error(error);
      
      setTokens({
            access_token,
        id_token,
            refresh_token: refreshToken
        });
    } catch(error) {
      console.log(error);
    }
  }

  const getUserInfo = async () => {
    try {
      const accessToken = store.get('access_token');
      const response = await fetch(VITE_AUTH0_USER_INFO_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      const { status } = response;

      if (status === 401) {
        attemps++;
        if (attemps < 3) {
          await tryRefreshToken();
          await getUserInfo();
        } else {
          store.remove('access_token');
          hasAccessToken = false;
          attemps = 0;
          await requestDeviceCode()
        }
        return;
      }
      const data = await response.json();
      userInfo = data;
    } catch(error) {
      console.log(error);
    }
  }

  const requestDeviceCode = async () => {
    try {
      loading = true;
      const response = await fetch(VITE_REQUEST_AUTH0_CODE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      loading = false;
      auth0Data = data;
      const { device_code, interval } = auth0Data;
 
      await tick();
      
      // @ts-ignore
      new QRCode(document.querySelector('#qr-code'), {
        text: auth0Data?.verification_uri_complete,
        width: 300,
        height: 300,
        colorDark: '#000000',
        colorLight: '#ffffff',
      });
  
      fetchInterval = setInterval(async () => {        
        try {
          const response = await fetch(VITE_REQUEST_AUTH0_TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({device_code}),
          });
        
          const data = await response.json();

          const { error, access_token, id_token, refresh_token } = data;
          
          if (error) throw new Error(error);
            
          setTokens({
                access_token,
            id_token,
                refresh_token
            });

          clearInterval(fetchInterval);
          
          fetchInterval = undefined;
          
          await getUserInfo();
          await getSampleImages();
          
          hasAccessToken = true;
        } catch(error) {
          console.log("Error ", error);
        }
      }, interval * 1000)
    } catch(error) {
      loading = false;
      console.error(error);
    }
  }

  const init = async () => {
    const accessToken = store.get('access_token');
    
    if (!accessToken) {
      hasAccessToken = false;
      return await requestDeviceCode();
    }

    hasAccessToken = true;
    await getUserInfo();
    await getSampleImages();
  }
  
  onMount(async () => {
    const qrCodeTagId = document.getElementById('qr-code-tag');

    if (!qrCodeTagId) {
      const qrCodeTag = document.createElement('script');
      qrCodeTag.id = 'qr-code-tag';
      qrCodeTag.onload = async () => {
        await init();
      };
      qrCodeTag.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
      document.head.appendChild(qrCodeTag);
    } else {
      await init();
    }
  })
</script>
<div class="container">
  <h1>Smart Tv Auth</h1>
  {#if hasAccessToken}
    {#if dataImages && dataImages.length}
      <div class="images-list">
        <div class="avatar">
          <h4>Olá {userInfo.given_name}</h4>
          <img src="{userInfo.picture}" alt="">
        </div>
        <h2>Tudo pronto, aproveite!</h2>
        <div class="inner">
          {#each dataImages as image}
            <div class="image" style="background: url({image?.urls?.small}) no-repeat center center"></div>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
  {#if !hasAccessToken}
    {#if loading}
      <div class="loading">
        <div class="lds-ring">
          <div></div>
          <div></div>
          <div></div>
          <div></div>
        </div>
        <p>Aguarde... <br />Estamos preparando sua incrível experiência!</p>
      </div>
    {/if}
    {#if !loading}
      <div class="result">
        <p>Agora acesse a URL abaixo no seu celular ou computador:</p>
        <p>{auth0Data?.verification_uri}</p>
        <p>E digite o código <b>{auth0Data?.user_code}</b><br /><br /></p>
        <p><b>Ou use o QR code abaixo</b></p><br />
        <div id="qr-code"></div>
      </div>
    {/if}
  {/if}
</div>
<style lang="scss">
  .container {
    width: 100%;
    max-width: 1210px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    min-height: 100%;

    h1 {
      font-family: 'Bungee Outline', cursive;
      text-align: center;
      font-size: 102px;
      margin-bottom: 20px;
    }

    p {
      font-family: 'Bungee Outline', cursive;
      font-size: 28px;
      text-align: center;
    }

    .result {
      margin: auto;

      p {
        font-family: sans-serif;
        margin: 0;
        padding: 2px 0;
        font-size: 26px;
      }
    }
  }

  .loading {
    margin: auto;
    display: flex;
    flex-direction: column;
    align-items: center;

    p {
      margin: 0;
    }
  }

  .images-list {
    display: flex;
    flex-direction: column;
    align-items: center;

    h2 {
      font-family: sans-serif;
    }

    .inner {
      display: flex;
      row-gap: 2;
      gap: 10px;
      flex-wrap: wrap;
      justify-content: center;
    }
  }

  .image {
    width: 200px;
    height: 200px;
    background-size: cover !important;
  }

  #qr-code {
    margin: 0 auto;
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .avatar {
    display: flex;
    flex-direction: column;
    align-items: center;

    h4 {
      font-family: sans-serif;
    }

    img {
      border-radius: 120px;
      width: 120px;
      height: 120px;
    }
  }
  
  // from https://loading.io/css/
  .lds-ring {
    display: inline-block;
    position: relative;
    width: 80px;
    height: 80px;
  }

  .lds-ring div {
    box-sizing: border-box;
    display: block;
    position: absolute;
    width: 52px;
    height: 52px;
    margin: 4px;
    border: 4px solid #686868;
    border-radius: 50%;
    animation: lds-ring 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
    border-color: #686868 transparent transparent transparent;
  }

  .lds-ring div:nth-child(1) {
    animation-delay: -0.45s;
  }

  .lds-ring div:nth-child(2) {
    animation-delay: -0.3s;
  }

  .lds-ring div:nth-child(3) {
    animation-delay: -0.15s;
  }

  @keyframes lds-ring {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
</style>  
