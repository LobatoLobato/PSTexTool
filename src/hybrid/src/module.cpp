/************************************************************************
 * Copyright 2022 Adobe
 * All Rights Reserved.
 *
 * NOTICE: Adobe permits you to use, modify, and distribute this file in
 * accordance with the terms of the Adobe license agreement accompanying
 * it.
 *************************************************************************
 */

#include <exception>
#include <stdexcept>
#include <string>
#include <string_view>
#include <format>

#include <cstdio>
#include <iostream>
#include <vector>
#include <optional>

#include <chrono>
#include <regex>

#include <TexConverter/Converter.hpp>
#include "stb_image.h"
#include "stb_image_write.h"
#include "pugixml.hpp"

#ifdef _WIN32
#include <windows.h>
#endif

#include <filesystem>
#include <fstream>
#include <queue>
#include <stack>

#include "../src/utilities/UxpAddon.h"
#include "../src/utilities/UxpTask.h"
#include "../src/utilities/UxpValue.h"

namespace
{
  struct UxpHelper {
    static void init(addon_env env) {
      env_ = env;
    }

    // template <class... Formats, size_t N, size_t... Is>
    // static std::tuple<Formats...> asTuple(const addon_value (&arr)[N], std::index_sequence<Is...>) {
    //   return std::make_tuple(std::move(convert<Formats>(arr[Is]))...);
    // }
    //
    // template <class... Formats, size_t N, class = std::enable_if_t<(N == sizeof...(Formats))>>
    // static std::tuple<Formats...> asTuple(const addon_value (&arr)[N]) {
    //   return asTuple<Formats...>(arr, std::make_index_sequence<N>{});
    // }
    //
    // template <typename... ArgTypes, size_t ArgCount = sizeof...(ArgTypes)>
    // static std::tuple<ArgTypes...> getArgs(addon_callback_info info) {
    //   addon_value argv[ArgCount];
    //   size_t argc = ArgCount;
    //   Check(UxpAddonApis.uxp_addon_get_cb_info(env_, info, &argc, argv, nullptr, nullptr));
    //
    //   return asTuple<ArgTypes...>(argv);
    // }

    template <size_t ArgC>
    static std::array<addon_value, ArgC> getArgs(addon_callback_info info) {
      std::array<addon_value, ArgC> args{};
      size_t argc = ArgC;
      Check(UxpAddonApis.uxp_addon_get_cb_info(env_, info, &argc, args.data(), nullptr, nullptr));
      return args;
    }
    static std::string getString(addon_value value) {
      size_t length = 0;
      Check(UxpAddonApis.uxp_addon_get_value_string_utf8(env_, value, nullptr, 0, &length));

      std::string result;
      if (length > 0) {
        std::vector<char> buffer(length + 2);
        size_t actual_length = 0;
        Check(UxpAddonApis.uxp_addon_get_value_string_utf8(env_, value, &buffer[0], length + 1, &actual_length));
        if (actual_length > 0) {
          // Make sure that we have a zero terminated string
          if (buffer[length] != 0)
            buffer[length] = 0;
          result = std::string(&buffer[0]);
        }
      }
      return result;
    }


    static addon_valuetype typeof(addon_value value) {
      addon_valuetype type;
      UxpAddonApis.uxp_addon_typeof(env_, value, &type);
      return type;
    }

    static addon_value uxpGetProperty(addon_value value, std::string_view key) {
      addon_value property = nullptr;
      Check(UxpAddonApis.uxp_addon_get_named_property(env_, value, key.data(), &property));

      return property;
    }
    static std::optional<addon_value> uxpGetOptionalProperty(addon_value value, std::string_view key) {
      addon_value property = nullptr;
      Check(UxpAddonApis.uxp_addon_get_named_property(env_, value, key.data(), &property));

      if (typeof(property) == addon_undefined || typeof(property) == addon_null) {
        return std::nullopt;
      }

      return property;
    }

    static addon_value uxpGetElement(addon_value value, size_t index) {
      addon_value element = nullptr;
      Check(UxpAddonApis.uxp_addon_get_element(env_, value, index, &element));

      return element;
    }

    template <class T>
    static T convert(addon_value uxp_value) {
      if (typeof(uxp_value) == addon_undefined || typeof(uxp_value) == addon_null) {
        throw std::runtime_error("Converted value is undefined");
      }

      if constexpr (std::is_same_v<T, bool>) {
        bool value{};
        Check(UxpAddonApis.uxp_addon_get_value_bool(env_, uxp_value, &value));
        return value;
      }
      else if constexpr (std::is_floating_point_v<T>) {
        double value{};
        Check(UxpAddonApis.uxp_addon_get_value_double(env_, uxp_value, &value));
        return T{value};
      }
      else if constexpr (std::is_same_v<T, int64_t> || (std::is_enum_v<T>)) {
        int64_t value{};
        Check(UxpAddonApis.uxp_addon_get_value_int64(env_, uxp_value, &value));
        return static_cast<T>(value);
      }
      else if constexpr (std::is_integral_v<T> && std::is_signed_v<T>) {
        int32_t value{};
        Check(UxpAddonApis.uxp_addon_get_value_int32(env_, uxp_value, &value));
        return static_cast<T>(value);
      }
      else if constexpr (std::is_integral_v<T> && std::is_unsigned_v<T>) {
        uint32_t value{};
        Check(UxpAddonApis.uxp_addon_get_value_uint32(env_, uxp_value, &value));
        return static_cast<T>(value);
      }
      else if constexpr (std::is_constructible_v<T, std::string>) {
        return T{getString(uxp_value)};
      }
      else if constexpr (std::is_constructible_v<T, addon_value>) {
        return T{uxp_value};
      }

      throw std::runtime_error("Value cannot be converted");
    }

    template <class T>
    static T getProperty(addon_value value, std::string_view key) {
      addon_value uxp_property = nullptr;
      Check(UxpAddonApis.uxp_addon_get_named_property(env_, value, key.data(), &uxp_property));

      if (typeof(uxp_property) == addon_undefined || typeof(uxp_property) == addon_null) {
        throw std::runtime_error(std::format("Missing property '{}'", key));
      }

      try {
        return convert<T>(uxp_property);
      } catch (std::exception&) {
        throw std::runtime_error("Property Type is not handled by 'getProperty'");
      }
    }

    template <class T>
    static std::optional<T> getOptionalProperty(addon_value value, std::string_view key) {
      addon_value uxp_property = nullptr;
      Check(UxpAddonApis.uxp_addon_get_named_property(env_, value, key.data(), &uxp_property));

      if (typeof(uxp_property) == addon_undefined || typeof(uxp_property) == addon_null) {
        return std::nullopt;
      }

      return getProperty<T>(value, key);
    }

    template <class T>
    static T getOptionalProperty(addon_value value, std::string_view key, T default_value) {
      return getOptionalProperty<T>(value, key).value_or(default_value);
    }

    struct UxpWrapper {
      [[nodiscard]] addon_value uxpValue() const { return uxp_value_; }

    protected:
      addon_value uxp_value_ = nullptr;
      UxpWrapper() = default;
      explicit UxpWrapper(addon_value value): uxp_value_(value) {}
    };

    template <class T>
    struct ArrayBuffer : UxpWrapper {
      T* data = nullptr;
      size_t length = 0;

      ArrayBuffer() = default;
      explicit ArrayBuffer(addon_value value)
      : UxpWrapper(value) {
        Check(UxpAddonApis.uxp_addon_get_arraybuffer_info(env_, value, reinterpret_cast<void**>(&data), &length));
      }

      ArrayBuffer(size_t data_len, T* buffer) {
        length = data_len;
        Check(UxpAddonApis.uxp_addon_create_arraybuffer(env_, length, reinterpret_cast<void**>(&buffer), &uxp_value_));
      }
      std::vector<T> toVector() {
        return {data, data + length};
      }
    };

  private:
    static inline addon_env env_ = nullptr;
  };

  struct Size {
    double w = 0, h = 0;

    Size() = default;
    Size(double w, double h): w(w), h(h) {}

    explicit Size(addon_value value)
    : w(UxpHelper::getProperty<double>(value, "w")),
      h(UxpHelper::getProperty<double>(value, "h")) {}
  };

  struct ImageData {
    Size size;
    uint8_t channels;
    uint8_t* data;

    explicit ImageData(addon_value value)
    : size(UxpHelper::getProperty<Size>(value, "size")),
      channels(UxpHelper::getProperty<uint8_t>(value, "channels")),
      data(UxpHelper::getProperty<UxpHelper::ArrayBuffer<uint8_t>>(value, "data").data) {}
  };

  struct ImageToTexConversionOptions {
    TexConverter::PixelFormat pixel_format;
    TexConverter::TextureType texture_type;
    TexConverter::MipmapFilter mipmap_filter;
    bool generate_mipmaps;
    bool pre_multiply_alpha;

    explicit ImageToTexConversionOptions(addon_value value)
    : pixel_format(UxpHelper::getOptionalProperty(value, "pixelFormat", TexConverter::PixelFormat::DXT5)),
      texture_type(UxpHelper::getOptionalProperty(value, "textureType", TexConverter::TextureType::OneD)),
      mipmap_filter(UxpHelper::getOptionalProperty(value, "mipmapFilter", TexConverter::MipmapFilter::Default)),
      generate_mipmaps(UxpHelper::getOptionalProperty(value, "generateMipmaps", false)),
      pre_multiply_alpha(UxpHelper::getOptionalProperty(value, "preMultiplyAlpha", false)) {}
  };

  struct Layer : UxpHelper::UxpWrapper {
    struct Bounds {
      double left, bottom, right, top;
      double width, height;

      Bounds() = default;
      explicit Bounds(addon_value value)
      : left(UxpHelper::getProperty<double>(value, "left")),
        bottom(UxpHelper::getProperty<double>(value, "bottom")),
        right(UxpHelper::getProperty<double>(value, "right")),
        top(UxpHelper::getProperty<double>(value, "top")),
        width(UxpHelper::getProperty<double>(value, "width")),
        height(UxpHelper::getProperty<double>(value, "height")) {}

      [[nodiscard]] bool isInsideGrid(const Size& grid) const {
        return static_cast<size_t>(left) % static_cast<size_t>(grid.w) == 0 &&
          static_cast<size_t>(right) % static_cast<size_t>(grid.w) == 0 &&
          static_cast<size_t>(bottom) % static_cast<size_t>(grid.h) == 0 &&
          static_cast<size_t>(top) % static_cast<size_t>(grid.h) == 0;
      }
    };

    std::string name;
    Bounds bounds{};

    Layer() = default;
    explicit Layer(addon_value value)
    : UxpWrapper(value),
      name(UxpHelper::getProperty<std::string>(value, "name")),
      bounds(UxpHelper::getProperty<Bounds>(value, "bounds")) {}

    static std::optional<addon_value> getUxpLayers(addon_value value) {
      return UxpHelper::uxpGetOptionalProperty(value, "layers");
    }
  };

  struct Document : UxpHelper::UxpWrapper {
    const std::string name;
    const std::string_view name_no_ext;
    const Size size;
    const std::optional<Size> grid;

    addon_value__* uxp_layers;

    explicit Document(addon_value value)
    : UxpWrapper(value),
      name(UxpHelper::getProperty<std::string>(value, "name")),
      name_no_ext(name.ends_with(".psd") ? std::string_view{name}.substr(0, name.size() - 4) : name),
      size(UxpHelper::getProperty<double>(value, "width"), UxpHelper::getProperty<double>(value, "height")),
      grid(UxpHelper::getOptionalProperty<Size>(value, "grid")),
      uxp_layers(UxpHelper::uxpGetProperty(value, "layers")) {}

    void iterateLayers(const std::function<void(const Document&, Layer&&)>& callback) const {
      std::deque groups{uxp_layers};

      while (!groups.empty()) {
        auto& group = groups.back();

        auto length = UxpHelper::getProperty<size_t>(group, "length");
        for (size_t lidx = 0; lidx < length; lidx++) {
          auto uxp_layer = UxpHelper::uxpGetElement(group, lidx);

          if (auto uxp_layer_group = Layer::getUxpLayers(uxp_layer); uxp_layer_group.has_value()) {
            groups.push_front(uxp_layer_group.value());
          }
          else {
            callback(*this, std::move(Layer{uxp_layer}));
          }
        }
        groups.pop_back();
      }
    }
  };

  // auto flattenLayers = [&layers, &get_uxp_layer, &msg, flatten_layers](addon_value uxp_layers) {
  //   auto length = UxpHelper::getProperty<size_t>(uxp_layers, "length");
  //   for (size_t lidx = 0; lidx < length; lidx++) {
  //     addon_value uxp_layer = get_uxp_layer(uxp_layers, lidx);
  //
  //     auto sub_layers = UxpHelper::getOptionalProperty<addon_value>(uxp_layer, "layers");
  //     if (sub_layers.has_value()) {
  //       flatten_layers(sub_layers.value());
  //     } else {
  //       layers.push_back(uxp_layer);
  //       auto layer_name = UxpHelper::getProperty<std::string>(uxp_layer, "name");
  //       msg += "  " + layer_name + ",\n";
  //     }
  //   }
  // };


  /*
 * This function will echo the provided argument after converting to and from a
 * standard value type.
 * No entry point should throw an exception. The implementation must use try/catch
 * and return nullptr if an exception was caught.
 * This method is invoked on the JavaScript thread.
 */
  addon_value exportAtlas(addon_env env, addon_callback_info info) {
    try {
      auto args = UxpHelper::getArgs<2>(info);
      Document doc(args[0]);
      std::string output_path = std::format("{}/{}.xml", UxpHelper::getString(args[1]), doc.name_no_ext);

      std::ofstream atlasf(output_path);
      atlasf << std::format(
        "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n"
        "<Atlas>\n"
        "  <Texture filename=\"{}.tex\" />\n"
        "  <Elements>\n",
        doc.name_no_ext
      );

      doc.iterateLayers([&atlasf](const Document& doc, Layer&& layer) {
          layer.bounds.bottom = doc.size.h - layer.bounds.bottom;
          layer.bounds.top = doc.size.h - layer.bounds.top;

          if (doc.grid.has_value() && !layer.bounds.isInsideGrid(doc.grid.value())) {
            layer.bounds.left = std::floor(layer.bounds.left / doc.grid->w) * doc.grid->w;
            layer.bounds.right = layer.bounds.left + std::ceil(layer.bounds.width / doc.grid->w) * doc.grid->w;
            layer.bounds.bottom = std::floor(layer.bounds.bottom / doc.grid->h) * doc.grid->h;
            layer.bounds.top = layer.bounds.bottom + std::ceil(layer.bounds.height / doc.grid->h) * doc.grid->h;
          }

          double u1 = layer.bounds.left / doc.size.w, u2 = layer.bounds.right / doc.size.w;
          double v1 = layer.bounds.bottom / doc.size.h, v2 = layer.bounds.top / doc.size.h;

          atlasf << std::format("    <Element name=\"{}.tex\" u1=\"{}\" u2=\"{}\" v1=\"{}\" v2=\"{}\" />\n",
            layer.name,
            u1, u2,
            v1, v2
          );
        }
      );

      atlasf << "  </Elements>\n";
      atlasf << "</Atlas>\n";

      return Value(std::format("Succesfully exported {}.", output_path)).Convert(env);
    } catch (...) {
      return CreateErrorFromException(env);
    }
  }

  addon_value exportTex(addon_env env, addon_callback_info info) {
    try {
      auto args = UxpHelper::getArgs<4>(info);
      const auto doc = Document(args[0]);
      const auto output_file = std::format("{}/{}.tex", UxpHelper::getString(args[1]), doc.name_no_ext);
      const auto image_data = ImageData(args[2]);
      const auto options = ImageToTexConversionOptions(args[3]);

      TexConverter::convertImageToTex(
        Image::Image8(image_data.data, image_data.size.w, image_data.size.h, image_data.channels),
        output_file,
        options.pixel_format,
        options.mipmap_filter,
        options.texture_type,
        options.generate_mipmaps,
        options.pre_multiply_alpha
      );

      return Value(std::format("Successfully exported {}.", output_file)).Convert(env);
    } catch (...) {
      return CreateErrorFromException(env);
    }
  }

  addon_value importTex(addon_env env, addon_callback_info info) {
    try {
      auto args = UxpHelper::getArgs<2>(info);

      const auto tex_file_path = UxpHelper::getString(args[0]);
      std::optional<std::string> atlas_file_path;
      try {
        atlas_file_path = UxpHelper::convert<std::string>(args[1]);
      } catch (std::exception&) {}

      const auto doc_name = std::filesystem::path(tex_file_path).filename().replace_extension(".psd").string();
      auto image = TexConverter::convertTexToImage(tex_file_path);

      addon_value obj;
      Check(UxpAddonApis.uxp_addon_create_object(env, &obj));
      Check(UxpAddonApis.uxp_addon_set_named_property(env, obj, "name", Value(doc_name).Convert(env)));
      Check(UxpAddonApis.uxp_addon_set_named_property(env, obj, "w", Value(double(image.width())).Convert(env)));
      Check(UxpAddonApis.uxp_addon_set_named_property(env, obj, "h", Value(double(image.height())).Convert(env)));

      pugi::xml_document atlas;
      if (!atlas_file_path.has_value() || !atlas.load_file(atlas_file_path->c_str())) {
        size_t data_len = image.height() * image.width() * image.channels();
        addon_value array_buffer;
        Check(UxpAddonApis.uxp_addon_create_arraybuffer(env, data_len, nullptr, &array_buffer));
        addon_value uint8_array;
        Check(UxpAddonApis.uxp_addon_create_typedarray(env, addon_uint8_array,
            data_len,
            array_buffer,
            0,
            &uint8_array
          )
        );
        for (int i = 0; i < data_len; ++i) {
          addon_value chval = nullptr;
          Check(UxpAddonApis.uxp_addon_create_uint32(env, image.data()[i], &chval));
          Check(UxpAddonApis.uxp_addon_set_element(env, uint8_array, i, chval));
        }
        Check(UxpAddonApis.uxp_addon_set_named_property(env, obj, "buffer", uint8_array));

        return obj;
      }

      addon_value buffers;
      Check(UxpAddonApis.uxp_addon_create_array(env, &buffers));
      size_t i = 0;
      for (pugi::xml_node element : atlas.child("Atlas").child("Elements").children("Element")) {
        auto name = std::string{element.attribute("name").as_string()};
        double u1 = element.attribute("u1").as_double(), u2 = element.attribute("u2").as_double();
        double v1 = element.attribute("v1").as_double(), v2 = element.attribute("v2").as_double();
        auto left = static_cast<size_t>(u1 * image.width()), right = static_cast<size_t>(u2 * image.width());
        auto bottom = image.height() - static_cast<size_t>(v1 * image.height());
        auto top = image.height() - static_cast<size_t>(v2 * image.height());
        auto width = right - left, height = bottom - top;
        auto stride = width * image.channels();
        auto data_len = height * stride;

        addon_value array_buffer;
        Check(UxpAddonApis.uxp_addon_create_arraybuffer(env, data_len, nullptr, &array_buffer));
        addon_value uint8_array;
        Check(UxpAddonApis.uxp_addon_create_typedarray(env, addon_uint8_array,
            data_len,
            array_buffer,
            0,
            &uint8_array
          )
        );

        size_t bufidx = 0;
        for (size_t y = top; y < bottom; y++) {
          for (size_t x = left; x < right; x++) {
            auto px = image.pixelAt(static_cast<int>(x), static_cast<int>(y));

            addon_value chval = nullptr;
            Check(UxpAddonApis.uxp_addon_create_uint32(env, px.r, &chval));
            Check(UxpAddonApis.uxp_addon_set_element(env, uint8_array, bufidx++, chval));

            Check(UxpAddonApis.uxp_addon_create_uint32(env, px.g, &chval));
            Check(UxpAddonApis.uxp_addon_set_element(env, uint8_array, bufidx++, chval));

            Check(UxpAddonApis.uxp_addon_create_uint32(env, px.b, &chval));
            Check(UxpAddonApis.uxp_addon_set_element(env, uint8_array, bufidx++, chval));

            Check(UxpAddonApis.uxp_addon_create_uint32(env, px.a, &chval));
            Check(UxpAddonApis.uxp_addon_set_element(env, uint8_array, bufidx++, chval));
          }
        }

        addon_value obj;
        Check(UxpAddonApis.uxp_addon_create_object(env, &obj));
        Check(UxpAddonApis.uxp_addon_set_named_property(env, obj, "name",
            Value(name.substr(0, name.size() - 4)).Convert(env)
          )
        );
        Check(UxpAddonApis.uxp_addon_set_named_property(env, obj, "buffer", uint8_array));
        Check(UxpAddonApis.uxp_addon_set_named_property(env, obj, "w", Value(double(width)).Convert(env)));
        Check(UxpAddonApis.uxp_addon_set_named_property(env, obj, "h", Value(double(height)).Convert(env)));
        Check(UxpAddonApis.uxp_addon_set_named_property(env, obj, "left", Value(double(left)).Convert(env)));
        Check(UxpAddonApis.uxp_addon_set_named_property(env, obj, "right", Value(double(right)).Convert(env)));
        Check(UxpAddonApis.uxp_addon_set_named_property(env, obj, "bottom", Value(double(bottom)).Convert(env)));
        Check(UxpAddonApis.uxp_addon_set_named_property(env, obj, "top", Value(double(top)).Convert(env)));

        Check(UxpAddonApis.uxp_addon_set_element(env, buffers, i++, obj));
      }

      Check(UxpAddonApis.uxp_addon_set_named_property(env, obj, "buffers", buffers));

      return obj;
    } catch (...) {
      return CreateErrorFromException(env);
    }
  }
  /*
   * This function will echo the provided argument after converting to and from a
   * standard value type.
   * The implementation illustrates how to create an asynchronous task, where the
   * initial call returns a promise/deferred which is then later resolved.
   * No entry point should throw an exception. The implementation must use try/catch
   * and return nullptr if an exception was caught.
   * This method is invoked on the JavaScript thread.
   */
  addon_value myAsyncEcho(addon_env env, addon_callback_info info) {
    try {
      // Allocate space for the first argument
      addon_value arg1;
      size_t argc = 1;
      Check(UxpAddonApis.uxp_addon_get_cb_info(env, info, &argc, &arg1, nullptr, nullptr));

      // Convert the first argument to a value that can be retained past the
      // return from this function. This is needed if you want to pass arguments
      // to an asynchronous/deferred task hand;er
      Value std_value(env, arg1);

      // Create a heap copy using move. This prevents a deep copy of the data & we can pass that
      // ptr to another context
      std::shared_ptr<Value> value_ptr(std::make_shared<Value>(std::move(std_value)));

      auto script_thread_handler = [](const Task& task, addon_env env, addon_deferred deferred) {
        try {
          HandlerScope scope(env);
          bool is_error = false;
          const Value& result = task.GetResult(is_error);
          addon_value result_value = result.Convert(env);

          if (is_error)
            Check(UxpAddonApis.uxp_addon_reject_deferred(env, deferred, result_value));
          else
            Check(UxpAddonApis.uxp_addon_resolve_deferred(env, deferred, result_value));
        } catch (...) {}
      };

      auto main_thread_handler = [value_ptr, script_thread_handler](Task& task) {
        try {
          task.SetResult(std::move(*(value_ptr)), false);
          task.ScheduleOnScriptingThread(script_thread_handler);
        } catch (...) {}
      };

      const auto task = Task::Create();
      return task->ScheduleOnMainThread(env, main_thread_handler);
    } catch (...) {
      return CreateErrorFromException(env);
    }
  }

  /* Method invoked when the addon module is being requested by JavaScript
   * This method is invoked on the JavaScript thread.
   */
  // ReSharper disable once CppInconsistentNaming
  addon_value Init(addon_env env, addon_value exports, const addon_apis& addon_apis) {
    addon_status status = addon_ok;
    addon_value fn = nullptr;

    UxpHelper::init(env);

    // MyAsyncEcho
    {
      status = addon_apis.uxp_addon_create_function(env, nullptr, 0, myAsyncEcho, nullptr, &fn);
      if (status != addon_ok) {
        addon_apis.uxp_addon_throw_error(env, nullptr, "Unable to wrap native function");
      }

      status = addon_apis.uxp_addon_set_named_property(env, exports, "my_echo_async", fn);
      if (status != addon_ok) {
        addon_apis.uxp_addon_throw_error(env, nullptr, "Unable to populate exports");
      }
    }

    // exportTex
    {
      status = addon_apis.uxp_addon_create_function(env, nullptr, 0, exportTex, nullptr, &fn);
      if (status != addon_ok) {
        addon_apis.uxp_addon_throw_error(env, nullptr, "Unable to wrap native function");
      }

      status = addon_apis.uxp_addon_set_named_property(env, exports, "exportTex", fn);
      if (status != addon_ok) {
        addon_apis.uxp_addon_throw_error(env, nullptr, "Unable to populate exports");
      }
    }


    // exportAtlas
    {
      status = addon_apis.uxp_addon_create_function(env, nullptr, 0, exportAtlas, nullptr, &fn);
      if (status != addon_ok) {
        addon_apis.uxp_addon_throw_error(env, nullptr, "Unable to wrap native function");
      }

      status = addon_apis.uxp_addon_set_named_property(env, exports, "exportAtlas", fn);
      if (status != addon_ok) {
        addon_apis.uxp_addon_throw_error(env, nullptr, "Unable to populate exports");
      }
    }

    // importTex
    {
      status = addon_apis.uxp_addon_create_function(env, nullptr, 0, importTex, nullptr, &fn);
      if (status != addon_ok) {
        addon_apis.uxp_addon_throw_error(env, nullptr, "Unable to wrap native function");
      }

      status = addon_apis.uxp_addon_set_named_property(env, exports, "importTex", fn);
      if (status != addon_ok) {
        addon_apis.uxp_addon_throw_error(env, nullptr, "Unable to populate exports");
      }
    }

    return exports;
  }
} // namespace

/*
 * Register initialization routine
 * Invoked by UXP during uxpaddon load.
 */
UXP_ADDON_INIT(Init)

void terminate(addon_env env) {
  try {} catch (...) {}
}

/* Register addon termination routine
 * Invoked by UXP during uxpaddon un-load.
 */
UXP_ADDON_TERMINATE(terminate)
