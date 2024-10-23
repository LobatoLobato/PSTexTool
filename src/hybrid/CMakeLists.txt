cmake_minimum_required(VERSION 3.28)
project(bolt-uxp-hybrid)

set(CMAKE_CXX_STANDARD 20)

add_library(bolt-uxp-hybrid SHARED)

set_target_properties(bolt-uxp-hybrid PROPERTIES SUFFIX ".uxpaddon")

target_include_directories(bolt-uxp-hybrid PRIVATE src src/api src/utilities)

target_link_libraries(bolt-uxp-hybrid PRIVATE TexConverter pugixml::static)

if(WIN32)
    set(PUBLIC_HYBRID_DIR ${CMAKE_SOURCE_DIR}/../../public-hybrid/win)
    if(PLATFORM STREQUAL "x86")
        target_compile_definitions(bolt-uxp-hybrid PRIVATE WIN32)
    endif()

    target_compile_definitions(bolt-uxp-hybrid PRIVATE $<IF:$<CONFIG:Debug>,_DEBUG,NDEBUG> SAMPLEUXPADDON1_EXPORTS _WINDOWS _USRDLL)
elseif (APPLE)
    set(PUBLIC_HYBRID_DIR ${CMAKE_SOURCE_DIR}/../../public-hybrid/mac)
else()
    message(SEND_ERROR "OS IS NOT SUPPORTED")
endif()

add_custom_command(TARGET bolt-uxp-hybrid POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy
        $<TARGET_FILE:bolt-uxp-hybrid>
        ${PUBLIC_HYBRID_DIR}/${PLATFORM}/$<TARGET_FILE_NAME:bolt-uxp-hybrid>
)

add_subdirectory(src)
add_subdirectory(vendor)