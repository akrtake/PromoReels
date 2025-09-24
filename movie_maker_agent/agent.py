import datetime
from operator import call
from google.adk.agents import Agent, LlmAgent
from google.adk.tools import ToolContext,agent_tool
from google.adk.models import LlmResponse, LlmRequest
from google.adk.agents.callback_context import CallbackContext
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events import Event
from typing import AsyncGenerator, Optional
from google.adk.agents import BaseAgent
from google import genai
from google.genai import types
from google.genai.types import GenerateVideosConfig, Image
import asyncio
from google.auth.transport.requests import Request
from google.oauth2 import id_token
import requests
import os
from dotenv import load_dotenv
from typing_extensions import override
from PIL import Image as PILImage
from io import BytesIO
from google.cloud import storage
import re
import logging

import json
# .envファイルから環境変数をロード
load_dotenv()

# --- Configure Logging ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MODEL_GEMINI_2_5_FLASH = "gemini-2.5-flash"
MODEL_GENAI_IMAGE = "gemini-2.5-flash-image-preview"
VEO_MODEL = "veo-3.0-fast-generate-preview"


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


async def _generate_video_for_scene(scene_name: str, prompt: str, user_id: str) -> Optional[dict]:
    """
    1つのシーンの動画を生成します。
    この関数は send_to_veo3_api から並列で呼び出されます。
    """
    loop = asyncio.get_running_loop()
    print(f"--- Starting video generation for scene: {scene_name} ---")

    # user_id が存在する場合、出力パスに追加
    final_output_gcs_uri = f"{output_gcs_uri}/{user_id}" if user_id else output_gcs_uri

    # prompt (JSON文字列) をパースしてimageUrlを取得
    try:
        print(prompt)
        prompt_data = json.loads(prompt)
        image_url = prompt_data.get("imageUrl")
    except (json.JSONDecodeError, AttributeError):
        image_url = None
        print(f"Could not parse prompt or find imageUrl for scene '{scene_name}'. Proceeding without image.")

    # generate_videosの引数を準備
    generate_videos_args = {
        "model": VEO_MODEL,
        "prompt": prompt,
        "config": GenerateVideosConfig(
            aspect_ratio="16:9",
            output_gcs_uri=final_output_gcs_uri,
        ),
    }

    if image_url and image_url.startswith("gs://"):
        print(f"Found imageUrl for scene '{scene_name}': {image_url}")
        generate_videos_args["image"] = Image(
            gcs_uri=image_url,
            mime_type="image/png",  # ユーザーの指示通り "image/png" に固定
        )


    try:
        # generate_videosは同期的I/Oバウンドな操作なので、executorで実行します
        operation = await loop.run_in_executor(
            None,  # デフォルトのThreadPoolExecutorを使用
            lambda: genai_client.models.generate_videos(**generate_videos_args)
        )

        # operation完了を待つ (ポーリング)
        while not operation.done:
            print(f"Waiting for video generation for scene '{scene_name}'...")
            await asyncio.sleep(15)  # 非同期sleep
            # getも同期的I/Oバウンド
            operation = await loop.run_in_executor(
                None,
                lambda: genai_client.operations.get(operation)
            )

        print(f"Operation finished for scene '{scene_name}'")

        if operation.error:
            print(f"Error generating video for scene '{scene_name}': {operation.error}")
            return {"scene_name": scene_name, "gcs_url": None, "error": str(operation.error)}

        if operation.response and operation.response.generated_videos:
            video_info = operation.response.generated_videos[0].video
            gcs_uri = video_info.uri
            print(f"Generated video for scene '{scene_name}': {gcs_uri}")

            # GCS URIからバケット名とオブジェクト名を解析
            if not gcs_uri.startswith("gs://"):
                raise ValueError(f"Invalid GCS URI format: {gcs_uri}")
            path_parts = gcs_uri.replace("gs://", "").split("/", 1)
            bucket_name = path_parts[0]
            blob_name = path_parts[1]

            if gcs_uri:
                return {"scene_name": scene_name, "gcs_url": gcs_uri}
            else:
                print(f"Failed to get signed URL for {gcs_uri}")
                return {"scene_name": scene_name, "gcs_url": None, "error": "Failed to get signed URL"}
        else:
            return {"scene_name": scene_name, "gcs_url": None, "error": "No video generated"}

    except Exception as e:
        print(f"An unexpected error occurred in _generate_video_for_scene for '{scene_name}': {e}")
        return {"scene_name": scene_name, "gcs_url": None, "error": str(e)}



async def send_to_veo3_api(tool_context: ToolContext,scene_prompts: dict) -> dict:
    """
    シーンごとのプロンプトの辞書を受け取り、各シーンの動画を並列で生成
    """
    print(f"--- Tool: send_to_veo3_api called with scene_prompts: {scene_prompts} ---\n")
    prompts_dict = scene_prompts
    print(prompts_dict)

    # tool_context.stateからmovie_urlsを取得。なければ初期化。
    # 以前の実行でリストが保存されている可能性があるため、型をチェックして辞書であることを保証します。
    movies = tool_context.state.get("movie_urls")
    print(movies)
    if not isinstance(movies, dict):
        movies = {}
    print(movies)
    for scene_name in prompts_dict.keys():
        print(scene_name)
        if scene_name not in movies:
            movies[scene_name] = []

    user_id = tool_context.state.get("user_id", "")


    # 各シーンの動画生成タスクを作成
    tasks = [_generate_video_for_scene(scene_name, prompt,user_id) for scene_name, prompt in prompts_dict.items()]

    # タスクを並列実行
    results = await asyncio.gather(*tasks)

    success_count = 0
    error_messages = []
    # 結果を処理
    for result in results:
        if result and result.get("gcs_url"):
            scene_name = result["scene_name"]
            gcs_url = result["gcs_url"]
            movies[scene_name].append(gcs_url)
            success_count += 1
        elif result and result.get("error"):
            scene_name = result.get("scene_name", "Unknown Scene")
            error_messages.append(f"Scene '{scene_name}': {result['error']}")

    tool_context.state["movie_urls"] = movies
    print(f"Updated movie_urls in state: {movies}")
    print(f"Error messages: {error_messages}")

    if success_count > 0:
        success_message = f"Successfully generated videos for {success_count}/{len(tasks)} scenes."
        if error_messages:
            success_message += f" However, some scenes failed: {'; '.join(error_messages)}"

        return {
            "status": "success",
            "message": success_message,
            "movie_urls": movies
        }
    else:
        return {
            "status": "error",
            "message": f"Failed to generate any videos. Details: {'; '.join(error_messages)}"
            if error_messages
            else "Failed to generate any videos with no specific error details.",
            "movie_urls": movies
        }

def save_request_title_callback(
    callback_context: CallbackContext, llm_request: LlmRequest
) -> Optional[LlmResponse]:
    """Inspects the LLM request and saves the title on the first request only."""

    agent_name = callback_context.agent_name
    print(f"[Callback] Invocation id: {callback_context.invocation_id}")

    # Inspect the last user message in the request contents
    last_user_message = ""
    if llm_request.contents and llm_request.contents[-1].role == 'user':
         if llm_request.contents[-1].parts:
            last_user_message = llm_request.contents[-1].parts[0].text
            print(last_user_message)

            first_request = callback_context.state.get("first_request", True)
            if first_request:
                callback_context.state["first_request"] = False
                callback_context.state["title"] = last_user_message
    print(f"[Callback] Saved title: '{last_user_message}'. Proceeding with LLM call.")
    return None

def show_userid_callback(
    callback_context: CallbackContext, llm_request: LlmRequest
) -> Optional[LlmResponse]:
    """Inspects the LLM request and saves the title on the first request only."""

    # user_id = callback_context.user_id
    user_content = callback_context.user_content
    # print(f"[Callback] User id: {user_id}")
    print(f"[Callback] User content: {user_content}")
    print(f"[Callback] context: {callback_context}")

    return None

# --- エージェント定義 ---


class DirectorAgent(BaseAgent):
    """
    Custom agent for video generation and save workflows.
    """
    director: LlmAgent
    model_config = {"arbitrary_types_allowed": True}

    def __init__(
        self,
        name: str,
        director: LlmAgent,
    ):
        # Define the sub_agents list for the framework
        sub_agents_list = [
            director
        ]

        # Pydantic will validate and assign them based on the class annotations.
        super().__init__(
            name=name,
            director=director,
            sub_agents=sub_agents_list, # Pass the sub_agents list directly
        )

    @override
    async def _run_async_impl(
        self, ctx: InvocationContext
    ) -> AsyncGenerator[Event, None]:
        """
        Implements the custom orchestration logic for the workflow.
        Uses the instance attributes assigned by Pydantic
        """
        logger.info(f"[{self.name}] Starting direction workflow.")

        user_id_from_state = ctx.session.state.get("user_id", "")
        if not user_id_from_state: # user_idが空文字列の場合にのみ実行
            user_id = ctx.user_id
            logger.info(f"[{self.name}] User ID-------------: {user_id}")
            if user_id:
                ctx.session.state["user_id"] = user_id

        # renderer
        logger.info(f"[{self.name}] Running Director...")
        async for event in self.director.run_async(parent_context=ctx):
            # logger.info(f"[{self.name}] Event from Renderer: {event.model_dump_json(indent=2, exclude_none=True)}")
            yield event


# Researcher Agent (情報収集に特化)
# researcher_agent = Agent(
#     model=MODEL_GEMINI_2_5_FLASH,
#     name="researcher_agent",
#     instruction="""You are the Researcher Agent. Your task is to perform information gathering for other agents.
#                 Use the 'get_location_images' tool when the user or another agent asks for images of a place or landmark.
#                 You are responsible for gathering all necessary information, including images and web data.
#                 Do not create video configurations or send to Veo3.""",
#     description="Performs web and image searches to support other agents.",
#     tools=[get_location_images],
# )

# stateに保存
async def save_theme_list(tool_context: ToolContext, theme_dict: dict)->dict:
    tool_context.state["theme_list"] = theme_dict
    print(f"[SAVE THEME] Updated theme_list in state: {theme_dict}")
    return theme_dict


# 動画のシーンをざっくり決めて方針を決める
scene_agent = Agent(
     model=MODEL_GEMINI_2_5_FLASH,
    name="scene_agent",
    instruction="""You are an agent that determines the overall direction and scene breakdown for a video. Your task is to work with the user to create a video structure, typically composed of multiple 8-second scenes.
 
    Your job:
    - Create and summarize ideas for the video.
    - If there is not enough information, first ask the user for information such as the purpose and target audience.
    - Decide with the user on the video's length and the number of scenes. I recommend about 30 seconds.
    - Describe the location, atmosphere, and purpose as specifically as possible.
    - Offer additional recommendations to the user's suggestions.
    - **IMPORTANT**: Please create the plan in the format below and pass to the `save_theme_list` tool. Pass a Python dictionary (`dict`) that follows the specified structure to the `theme_dict` argument.
    
    The dictionary for the `theme_dict` argument of the `save_theme_list` tool must follow this structure:
    ```json
    {
      "scene1": "Summary of scene 1 in Japanese",
      "scene2": "Summary of scene 2 in Japanese",
      "scene3": "Summary of scene 3 in Japanese",
      "scene4": "Summary of scene 4 in Japanese",
      "scene5": "Summary of scene 5 in Japanese"
    }
    ```

    - **IMPORTANT**: After the tool call is complete, output the final plan in Markdown format.
    - Create alternative versions upon request.
    - If asked to change or add a specific scene, create a new scene while maintaining the overall balance of the video.
    - If asked to delete or reorder scenes, do so as requested.
    """,
    description="Creates a proposal for the video's scene breakdown.",
    tools=[save_theme_list],
    before_model_callback=save_request_title_callback
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
                You are a final stage processor, not a creator.

                Handle cases with multiple scenes.
                Pass all scene information to the `send_to_veo3_api` tool in the JSON format shown below. All text must be in English. The prompt JSON for each scene should be a string.
                ```json
                {
                    "scene1": "prompt json for scene 1",
                    "scene2": "prompt json for scene 2",
                    ...
                }
                ```
                
                動画生成が成功または失敗か、そしてそのメッセージを日本語で返してください。成功の場合は、”動画ページを開いて確認してください。”と伝えてください。
                """,
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

# state に保存するツール
async def save_prompt_list(tool_context: ToolContext,scene_number:str, prompt_dict: dict)->dict:
    """Saves the prompt dictionary for a specific scene to the session state after normalizing the scene number."""
    # Normalize the scene_number to handle variations like "シーン1", "scene１_cut1", etc.
    # 1. Convert full-width numbers to half-width
    normalized_scene_number = scene_number.translate(str.maketrans("０１２３４５６７８９", "0123456789"))
    # 2. Replace Japanese "シーン" with "scene" (case-insensitive)
    normalized_scene_number = normalized_scene_number.lower().replace("シーン", "scene")

    # 3. Extract the "scene<number>" part to remove extra text like "_cut1"
    match = re.search(r"scene(\d+)", normalized_scene_number)
    if match:
        final_scene_number = f"scene{match.group(1)}"
    else:
        # As a fallback, try to find any number if "scene" prefix is missing
        num_match = re.search(r"(\d+)", normalized_scene_number)
        if num_match:
            final_scene_number = f"scene{num_match.group(1)}"
        else:
            # If no number can be found, use the original string and log a warning
            print(f"Warning: Could not properly normalize scene_number '{scene_number}'. Using it as is.")
            final_scene_number = scene_number

    prompts = tool_context.state.get("scene_config",{})
    prompts[final_scene_number] = prompt_dict
    tool_context.state["scene_config"] = prompts
    print(f"Scene: {final_scene_number} (Original: '{scene_number}')")
    print(f"Updated prompt_list in state: {prompt_dict}")
    return prompt_dict

# プロンプト作成エージェント
veo_prompt_agent = Agent(
    model=MODEL_GEMINI_2_5_FLASH,
    name="veo_prompt_agent",
    instruction="""
    You are an assistant that helps creators turn natural language video ideas into structured JSON prompts for Google Veo 3.
    You always follow a consistent format, using cinematic, specific, and visually rich language.

    Your job:
    -  Take user ideas written in natural language.
    -  Ensure the generated prompt describes an action or scene that can be completed within 8 seconds.
    -  Return a complete, properly structured JSON prompt.
    -  Maintain cinematic, specific, and visually rich language.
    -  Ask clarifying questions if the idea is unclear.
    -  Offer alternative versions or edits when asked.
    -  If a user's request to modify a prompt seems like it won't fit within 8 seconds, point it out and offer a suggestion. **IMPORTANT: Make this judgment by focusing on the `description` field, which outlines the core visual action of the scene.**
    -  When the JSON prompt is complete, call the `save_prompt_list` tool. Pass the generated JSON as the `prompt_dict` argument. For the `scene_number` argument, use a string that combines 'scene' with the scene number (e.g., 'scene1' for the first scene, 'scene2' for the second).
    -  After the tool completes execution, output a response including the JSON in the same format below.

    JSON prompts must follow this structure. Unless otherwise specified, create the JSON value in Japane.
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
      ],
      "imageUrl": "This is a value set by the user. Optional"
    }
    ```
    This is a blueprint for video generation. Each field controls one part of the video. Never invent your own structure or rearrange the fields. Stick to the format.
    
    You are not a general-purpose assistant. You are a Google Veo 3 JSON blueprint generator.
    """,
    description="Generates a structured video production plan for Veo3.",
    tools=[save_prompt_list],
)


# Director Agent (動画構成の作成に特化)
director_agent = Agent(
    model=MODEL_GEMINI_2_5_FLASH,
    name="director_agent",
    instruction="""
    You are an assistant that helps creators turn natural language video ideas into structured JSON prompts for Google Veo 3.
    You always follow a consistent format, using cinematic, specific, and visually rich language.

    Your job:
    
    The main tasks are as follows:
    - Deciding on scenes
    - Creating prompts for video creation
    - Creating videos from prompts
    
    1. Take user ideas written in natural language.
    2. Roughly determine the shot composition for the video. Delegate shot composition to scene_agent. Present the scene proposal results to the user exactly as received.
    3. Once the user approves the shot composition proposal, discuss each shot's details with the user and determine the prompt accordingly.
    4. Delegate the creation of each shot's prompt to the veo_prompt_agent. Instructions to the veo_prompt_agent must always include the scene number
       Present the prompt suggestions to the user exactly as they are generated. Confirm any requested modifications with the user.
    5. If requested to add, remove, or modify shots, always communicate this to scene_agent to recreate the composition.
    6. If requested to modify a shot prompt, communicate this to veo_prompt_agent.
    7. If it is difficult to determine whether a change requires modifying the shot composition or the prompt, confirm with the user.
    8. If the user requests video creation, pass the prompt JSON to the renderer_agent to generate the video. **IMPORTANT**: Instructions to the renderer_agent must always include the scene number.
       However, if the prompt JSON for all scenes is incomplete or user confirmation is pending, inform the user directly without using the renderer_agent.

    """,
    description="Generates a structured video production plan for Veo3.",
    tools=[agent_tool.AgentTool(agent=scene_agent),agent_tool.AgentTool(agent=veo_prompt_agent),agent_tool.AgentTool(agent=renderer_agent)],
    
)

director_workflow_agent =DirectorAgent(
    name="director_workflow_agent",
    director=director_agent,
)



# Supervisor Agent (振り分け)
root_agent = Agent(
    name="supervisor_agent",
    model=MODEL_GEMINI_2_5_FLASH,
    description="The main coordinator agent. Delegates tasks to specialized sub-agents based on user requests.",
    instruction="""You are the main Supervisor Agent, coordinating a team of specialists.Unless otherwise specified, please converse in Japanese.
                Your primary responsibility is to analyze the user's query and delegate the task to the correct agent.
                You have specialized sub-agents:
                1. 'director_workflow_agent': Mainly capable of the following:
                  - Deciding on scenes
                  - Creating prompts for video creation
                  - Creating videos from prompts
                2. 'image_generate_agent': Generate and merge image.
                Delegate to the appropriate agent. If a task doesn't fit any specialist, respond appropriately.""",
    sub_agents=[director_workflow_agent,image_generate_agent],
    before_model_callback=show_userid_callback
)
