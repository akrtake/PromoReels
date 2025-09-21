import code
import datetime
from pickletools import bytes1
from zoneinfo import ZoneInfo
from google.adk.agents import Agent, LoopAgent, LlmAgent, BaseAgent, SequentialAgent
from google.adk.events import Event, EventActions
from google.adk.tools import FunctionTool,ToolContext
from google.adk.agents.invocation_context import InvocationContext
from google.adk.agents.callback_context import CallbackContext
from google.adk.models.lite_llm import LiteLlm
from google.adk.sessions import DatabaseSessionService, VertexAiSessionService
from google.adk.runners import Runner
from google import genai
from google.genai import types
from typing import AsyncGenerator
from google.genai.types import GenerateVideosConfig, Image
from google.auth.transport.requests import Request
from google.oauth2 import id_token
import requests
import os
import time
from dotenv import load_dotenv
from typing import Optional
from PIL import Image as PILImage
from io import BytesIO
import base64
from google.cloud import storage
import tempfile


# .envファイルから環境変数をロード
load_dotenv()

MODEL_GEMINI_2_5_FLASH = "gemini-2.5-flash"
MODEL_GENAI_IMAGE = "gemini-2.5-flash-image-preview"

genai_client = genai.Client()
image_genai_client = genai.Client(location="global")
output_gcs_uri= "gs://ai-agent-hackathon-dist-akira2025/video_output"

input1_gcs_uri = "gs://ai-agent-hackathon-dist-akira2025/fortest/input1.jpg"
input2_gcs_uri = "gs://ai-agent-hackathon-dist-akira2025/fortest/input2.png"
GCS_BUCKET_NAME = "ai-agent-hackathon-dist-akira2025"
GCS_IMAGE_FOLDER = "fortest"

SIGNED_URL_FUNCTIONS_URL = "https://asia-northeast1-aiagenthackathon-469114.cloudfunctions.net/create_signed_url"

# --- ツール関数 (変更なし) ---
def generate_signed_url(bucket_name, file_name, expiration_time=3600):
    """
    GCSオブジェクトの認証済みURLを生成します。

    Args:
        bucket_name: GCSバケット名
        blob_name: GCS内のオブジェクトのパス
        expiration_time: URLの有効期限（秒）。デフォルトは1時間。

    Returns:
        認証済みURL
    """
    # IDトークンの生成
    auth_req = Request()
    token = id_token.fetch_id_token(auth_req, SIGNED_URL_FUNCTIONS_URL)

    # リクエストヘッダーにAuthorizationヘッダーを追加
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {token}'
    }

    # リクエストボディ
    data = {
        'bucketName': bucket_name,
        'fileName': file_name
    }

    try:
        response = requests.post(SIGNED_URL_FUNCTIONS_URL, headers=headers, json=data)
        print(response)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error calling Cloud Function: {e}")
        return None

def upload_blob(bucket_name, source_file_name, destination_blob_name):
    """バケットにファイルをアップロードします。"""
    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(destination_blob_name)
    blob.upload_from_file(source_file_name, content_type="image/png")
    print(f"File uploaded to gs://{bucket_name}/{destination_blob_name}.")
    return f"gs://{bucket_name}/{destination_blob_name}"

# def merge_images(text_input: str, first_image_base64: str, second_image_base64: str):
def merge_images(text_input: str):
    """
    2枚の画像をユーザーの指示に基づいてマージし、結果の画像を保存して表示します。

    Args:
        text_input: 画像マージに関するユーザーの具体的な指示（日本語）。

    Returns:
        なし (画像をファイルに保存し、表示します)
    """
    print("merge_imagesツールが呼び出されました。")
    # Base64文字列をデコードして画像バイナリデータに戻す
    try:
        print(f"1枚目の画像URI: {input1_gcs_uri}")
        print(f"2枚目の画像URI: {input2_gcs_uri}")

        # genai.types.Partに変換
        first_image_part = types.Part.from_uri(file_uri=input1_gcs_uri)
        second_image_part = types.Part.from_uri(file_uri=input2_gcs_uri)

        print(f"1枚目の画像Part: {first_image_part}")
        print(f"2枚目の画像Part: {second_image_part}")

    except Exception as e:
        print(f"画像データのデコードに失敗しました: {e}")
        return "エラー: 画像データの形式が正しくありません。"

    generate_content_config = types.GenerateContentConfig(
        temperature = 1,
        top_p = 0.95,
        max_output_tokens = 32768,
        response_modalities = ["TEXT", "IMAGE"]
    )

    try:
    # ここではバイトデータとして渡すことを想定します。
        # print("before banana")
        response = image_genai_client.models.generate_content(
            model="gemini-2.5-flash-image-preview", # 画像処理に特化したモデルを使用
            # contents=[text_input,first_image_data, second_image_data],
            contents = [
                types.Content(
                role="user",
                parts=[
                    first_image_part,
                    second_image_part,
                    types.Part.from_text(text=text_input)
                ]
                )
            ],
            config = generate_content_config
        )
        # print("after banana", response)

        for part in response.candidates[0].content.parts:
            if part.text is not None:
                print(part.text)
            elif part.inline_data is not None:
                image = PILImage.open(BytesIO(part.inline_data.data))
                # image.save("generated_image.png")
                timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
                destination_path = f"{GCS_IMAGE_FOLDER}/merged_{timestamp}.png"
                image_bytes_io = BytesIO()
                image.save(image_bytes_io, format='PNG')
                image_bytes_io.seek(0)
                gcs_uri = upload_blob(GCS_BUCKET_NAME, image_bytes_io, destination_path)
                print(gcs_uri)
                signed_url = generate_signed_url(GCS_BUCKET_NAME, destination_path)
                print(signed_url)

                return signed_url

        print("===========")
        # print(response)
    except Exception as e:
            print(f"呼び出しに失敗しました: {e}")
            return "エラー: 生成された画像の処理中に問題が発生しました。"



def get_location_images(query: str) -> dict:
    """
    Collects multiple images for a given location (address or place name) using Google Maps APIs.
    Returns a dictionary with 'status' and a list of image URLs or an error message.
    """
    print(f"--- Tool: get_location_images called with query: {query} ---\n")
    google_maps_api_key = os.environ.get("GOOGLE_MAPS_API_KEY")
    if not google_maps_api_key:
        return {
            "status": "error",
            "error_message": "GOOGLE_MAPS_API_KEY environment variable not set.",
        }

    image_urls = []
    
    # 1. Places API - Find Place to get place_id and lat/lng
    find_place_url = "https://maps.googleapis.com/maps/api/place/findplacefromtext/json"
    find_place_params = {
        "input": query,
        "inputtype": "textquery",
        "fields": "place_id,geometry",
        "key": google_maps_api_key,
    }
    try:
        find_place_response = requests.get(find_place_url, params=find_place_params)
        find_place_response.raise_for_status()
        find_place_data = find_place_response.json()

        if find_place_data["status"] == "OK" and find_place_data["candidates"]:
            place_id = find_place_data["candidates"][0]["place_id"]
            location = find_place_data["candidates"][0]["geometry"]["location"]
            lat = location["lat"]
            lng = location["lng"]
            print(f"Found place_id: {place_id}, Lat: {lat}, Lng: {lng}\n")
        else:
            return {
                "status": "error",
                "error_message": f"Could not find place for query: {query}. Status: {find_place_data.get('status', 'Unknown')}",
            }
    except requests.exceptions.RequestException as e:
        return {
            "status": "error",
            "error_message": f"Error calling Places API (Find Place): {e}",
        }

    # 2. Places API - Place Details to get photo_references
    place_details_url = "https://maps.googleapis.com/maps/api/place/details/json"
    place_details_params = {
        "place_id": place_id,
        "fields": "photos",
        "key": google_maps_api_key,
    }
    try:
        place_details_response = requests.get(place_details_url, params=place_details_params)
        place_details_response.raise_for_status()
        place_details_data = place_details_response.json()

        if place_details_data["status"] == "OK" and "photos" in place_details_data["result"]:
            photos = place_details_data["result"]["photos"]
            for photo in photos[:5]:
                photo_reference = photo["photo_reference"]
                photo_url = (
                    f"https://maps.googleapis.com/maps/api/place/photo?maxwidth=400"
                    f"&photoreference={photo_reference}&key={google_maps_api_key}"
                )
                image_urls.append(photo_url)
            print(f"Collected {len(image_urls)} Place Photos.\n")
        else:
            print(f"No Place Photos found for {query}.\n")
    except requests.exceptions.RequestException as e:
        print(f"Error calling Places API (Place Details): {e}\n")
    
    # 3. Street View Static API
    street_view_url = "https://maps.googleapis.com/maps/api/streetview"
    headings = [0, 90, 180, 270]
    for heading in headings:
        street_view_params = {
            "size": "600x300",
            "location": f"{lat},{lng}",
            "heading": heading,
            "pitch": 0,
            "key": google_maps_api_key,
        }
        try:
            street_view_image_url = f"{street_view_url}?{requests.compat.urlencode(street_view_params)}"
            image_urls.append(street_view_image_url)
            print(f"Added Street View image for heading {heading}.\n")
        except Exception as e:
            print(f"Error constructing Street View URL: {e}\n")

    if image_urls:
        return {
            "status": "success",
            "image_urls": image_urls,
        }
    else:
        return {
            "status": "error",
            "error_message": "No images could be retrieved for the specified location.",
        }




async def send_to_veo3_api(tool_context: ToolContext,video_config_text: str) -> dict:
    """
    Sends the generated video configuration to the Veo3 API for video creation.
    """
    print(f"--- Tool: send_to_veo3_api called with video_config_text: {video_config_text[:100]}... ---\n")
    # try:
    #     image_data = PILImage.open('generated_image.png')
    # except FileNotFoundError:
    #     return {"status": "error", "error_message": "generated_image.png が見つかりません。"}
    # except Exception as e:
    #     return {"status": "error", "error_message": f"画像の読み込みに失敗しました: {e}"}

    # 2. 画像をバイトデータに変換し、Base64でエンコードする
    # buffered = BytesIO()
    # image_data.save(buffered, format="PNG")
    # image_bytes = buffered.getvalue()
    # image_base64 = base64.b64encode(image_bytes).decode('utf-8')

    try:
        # veo_image = Image(
        #     # bytes_base64_encoded=image_base64,
        #     gcs_uri="gs://ai-agent-hackathon-dist-akira2025/generated_image.png",
        #     mime_type="image/png"
        # )
        operation = genai_client.models.generate_videos(
            model="veo-3.0-generate-preview",
            prompt=video_config_text,
            # ｓimage=veo_image,
            config=GenerateVideosConfig(
                aspect_ratio="16:9",
                output_gcs_uri=output_gcs_uri,
            ),
        )

        while not operation.done:
            time.sleep(15)
            operation = genai_client.operations.get(operation)
            print(operation)

        print(operation.response)
        
        if operation.response:
            movies = tool_context.state.get("movie_urls",[])
            print(movies)
            movies.append(operation.response.generated_videos[0].video.uri)
            tool_context.state["movie_urls"] = movies
            
            print(operation.result.generated_videos[0].video.uri)
            try:
                video_info = operation.response.generated_videos[0].video
                gcs_uri = video_info.uri
                mime_type = video_info.mime_type
                print(f"Generated video GCS URI: {gcs_uri}")
                print(f"MIME type: {mime_type}")

                # # GCS URIからバケット名とオブジェクト名（blob名）を解析
                # if not gcs_uri.startswith("gs://"):
                #     raise ValueError(f"Invalid GCS URI format: {gcs_uri}")
                
                # path_parts = gcs_uri.replace("gs://", "").split("/", 1)
                # bucket_name = path_parts[0]
                # blob_name = path_parts[1]

                # # GCSから動画ファイルをバイトデータとしてダウンロード
                # storage_client = storage.Client()
                # bucket = storage_client.bucket(bucket_name)
                # blob = bucket.blob(blob_name)
                # video_bytes = blob.download_as_bytes()

                # # GCSからダウンロードしたバイトデータから直接Partオブジェクトを作成
                # # movie_part = types.Part.from_bytes(data=video_bytes, mime_type=mime_type)
                # movie_part = types.Part.from_uri(file_uri=gcs_uri, mime_type=mime_type)
                # print(movie_part)
                # version = await tool_context.save_artifact(filename="test.mp4", artifact=movie_part)
                # print(f"Artifact saved successfully. Version: {version}")
            except Exception as e:
                print(f"Error saving artifact: {e}")
            return {
                "status": "success",
                "message": f"Video configuration successfully sent to Veo3 API. Response: {operation.response}",
                "veo3_response": operation.response
            }
        else:
            return {
                "status": "error",
                "error_message": f"Veo3 API returned an error: {operation.error}",
                "veo3_response": operation.error
            }
    except requests.exceptions.RequestException as e:
        return {
            "status": "error",
            "error_message": f"Failed to connect to Veo3 API: {e}",
        }
    except Exception as e:
        return {
            "status": "error",
            "error_message": f"An unexpected error occurred while sending to Veo3 API: {e}",
        }

# --- エージェント定義 ---

# Researcher Agent (情報収集に特化)
researcher_agent = Agent(
    model=MODEL_GEMINI_2_5_FLASH,
    name="researcher_agent",
    instruction="""You are the Researcher Agent. Your task is to perform information gathering for other agents.
                Use the 'get_location_images' tool when the user or another agent asks for images of a place or landmark.
                You are responsible for gathering all necessary information, including images and web data.
                Do not create video configurations or send to Veo3.""",
    description="Performs web and image searches to support other agents.",
    tools=[get_location_images],
)

# Director Agent (動画構成の作成に特化)
director_agent = Agent(
    model=MODEL_GEMINI_2_5_FLASH,
    name="director_agent",
    instruction="""
    You are an assistant that helps creators turn natural language video ideas into structured JSON prompts for Google Veo 3.
    You always follow a consistent format, using cinematic, specific, and visually rich language.

    Your job:
    1. Take user ideas written in natural language.
    2. Return a complete, properly structured JSON prompt.
    3. Maintain cinematic, specific, and visually rich language.
    4. Ask clarifying questions if the idea is unclear.
    5. Offer alternative versions or edits when asked.

    JSON prompts must follow this structure:
    ```json
    {
      "description": "Cinematic summary of the scene-what happens visually",
      "style": "Visual mood or aesthetic (e.g. cinematic, magical realism)",
      "camera": "Camera movement or framing (e.g. dolly-in, fixed wide shot)",
      "lens": "Lens or framing type (optional)",
      "lighting": "How the scene is lit (e.g. neon, sunset, natural glow)",
      "environment": "Scene location or space (optional)",
      "audio": "Music or sound design if specified (optional)",
      "elements": [
        "List of objects, subjects, or visual items that must appear"
      ],
      "motion": "How objects move or transform in the scene",
      "ending": "What the final visual moment or shot looks like",
      "text": "Usually 'none' unless on-screen text is mentioned",
      "keywords": [
        "descriptive tags that reinforce theme, tone, or subject"
      ]
    }
    ```
    This is a blueprint for video generation. Each field controls one part of the video. Never invent your own structure or rearrange the fields. Stick to the format.

    You are not a general-purpose assistant. You are a Google Veo 3 JSON blueprint generator.
    """,
    description="Generates a structured video production plan for Veo3, optionally using research results.",
    # tools=[get_video_configuration],
    output_key="video_config"
)

# Renderer Agent (動画作成の最終プロセスに特化)
renderer_agent = Agent(
    model=MODEL_GEMINI_2_5_FLASH,
    name="renderer_agent",
    instruction="""You are the Renderer Agent. Your task is to process a video configuration received in a specific JSON format.
                First, translate the entire JSON content into English.
                Then, use the 'send_to_veo3_api' tool to initiate the video creation process, passing the translated JSON as the input.
                You should only be called after a full video configuration has been generated by another agent.
                Do not modify the JSON structure; only translate the values of its fields.
                You are a final stage processor, not a creator.""",
    description="Translates the video configuration JSON to English and sends it to the Veo3 API for rendering.",
    tools=[send_to_veo3_api],
)

image_generate_agent = Agent(
    model=MODEL_GEMINI_2_5_FLASH,
    name="imagen_agent",
    instruction="""
あなたは画像を生成、編集、またはマージする専門家です。
ユーザーが2枚の画像をマージしてほしいと指示している場合、`merge_images`ツールを使用することを検討してください。作成された画像のsigned_urlを返してください。
ユーザーからの指示には、マージ方法や最終的な画像に関する詳細な説明が含まれる場合があります。それらの情報を`text_input`引数に含めてください。
""",
    description="Translates the video configuration JSON to English and sends it to the Veo3 API for rendering.",
    tools=[merge_images],
)

# Supervisor Agent (全体の司令塔)
root_agent = Agent(
    name="supervisor_agent",
    model=MODEL_GEMINI_2_5_FLASH,
    description="The main coordinator agent. Delegates tasks to specialized sub-agents based on user requests.",
    instruction="""You are the main Supervisor Agent, coordinating a team of specialists.
                Your primary responsibility is to analyze the user's query and delegate the task to the correct agent.
                You have specialized sub-agents:
                1. 'director_agent': Handles all video-related requests, including generating outlines and conducting research for location suggestions if needed.
                2. 'renderer_agent': Sends video configurations to Veo3 for video creation.
                3. 'image_generate_agent': Generate and merge image.
                Delegate to the appropriate agent. If a task doesn't fit any specialist, respond appropriately.""",
    # tools=[yeild_test],
    sub_agents=[director_agent,researcher_agent, renderer_agent,image_generate_agent], # researcher_agentを直接ここに追加しない
)
