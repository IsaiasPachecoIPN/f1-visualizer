import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, HostListener, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Openf1ApiService } from '../../services/openf1-api.service';
import { AnimationControlService } from '../../services/animation-control.service';
import { PositionService } from '../../services/position.service';
import { DriverVisibilityService } from 'src/app/services/driver-visibility.service';
import { RaceCommentaryService } from '../../services/race-commentary.service';
import { LoadingService } from '../../services/loading.service';
import { CarTooltipComponent } from '../car-tooltip/car-tooltip.component';
import { Subscription, forkJoin, of, Observable, merge, BehaviorSubject } from 'rxjs';
import { map, switchMap, shareReplay } from 'rxjs/operators';
import { LapDataService } from '../../services/lap-data.service';

const CAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 609 410" xml:space="preserve"><path fill="#E43834" d="M534.023 241.154c-12.364 1.94-24.728 3.882-37.796 5.564-1.012-.38-1.337-.637-1.624-.6-15.857 2.038-31.713 4.09-47.559 6.22-.411.056-.704.993-1.053 1.519-5.57 1.02-11.117 2.189-16.714 3.028-8.425 1.264-16.885 2.29-25.328 3.431-8.605 1.164-17.211 2.324-25.812 3.524-7.303 1.018-14.607 2.034-21.895 3.157-8.078 1.245-16.115 2.785-24.217 3.837-3.186.414-4.663 1.377-5.58 4.727-1.755 6.418-4.494 12.56-6.575 18.9a18.2 18.2 0 0 0-.853 6.741c.756 11.263-9.246 26.47-20.875 29.5-2.566-.2-4.506-.057-6.44-.122-4.243-.14-8.943.735-12.647-.78-16.807-6.88-33.326-14.464-49.977-21.728-1.309-.57-2.841-.63-4.627-.942-1.05-.19-1.74-.364-2.516-.85-4.118-1.915-8.152-3.517-12.397-5.144-.21-.025-.553-.275-.608-.618-5.182-2.293-10.308-4.242-15.764-6.216-.935-.27-1.541-.515-2.233-1.064-3.683-1.642-7.281-2.981-11.227-4.286-.794-.087-1.24-.208-1.743-.654-8.495-3.9-16.932-7.476-25.652-11.037-.628-.118-.976-.253-1.38-.734-3.437-1.953-6.754-3.717-10.22-5.116-2.892-1.168-3.806-2.97-3.796-6.08.126-37.417.113-74.833.448-112.417 11.067-4.691 21.863-9.124 32.564-13.773 7.162-3.111 14.19-6.53 21.558-9.888.652-.18 1.025-.284 1.791-.328 6.574-2.18 12.864-4.158 18.914-6.706 17.137-7.22 34.095-14.868 51.284-21.957 9.823-4.052 19.098-10.553 30.67-8.319 10.773 1.28 17.435 8.269 21.528 17.304 2.33 5.142 1.776 11.512 3.34 17.1 2.4 8.583 4.768 17.341 8.743 25.22 1.252 2.482 7.56 2.744 11.653 3.389 7.628 1.203 15.338 1.875 22.997 2.889 12.816 1.696 25.612 3.553 38.432 5.22 12.256 1.593 24.539 2.987 36.795 4.58 2.049.265 4.023 1.099 6.496 2.274 2.239.9 4.005 1.271 5.791 1.482 13.05 1.537 26.105 3.042 39.158 4.557 5.335.875 10.645 1.97 16.01 2.57 7.085.791 14.215 1.178 21.323 1.77 2.278.19 4.549.482 7.546.858 9.604 1.703 18.491 3.246 27.367 4.853 7.182 1.3 14.351 2.677 21.696 4.24.492.39.813.562 1.134.733 15.173 9.461 15.873 31.708.935 40.888-1.158.47-1.696.78-2.601 1.146-6.22 1.366-12.025 2.966-17.936 3.916-9.855 1.585-19.778 2.754-29.887 4.124-.214.026-.64.098-.64.098M269.083 201.5c.001 13.49.188 26.985-.102 40.47-.098 4.583 1.184 6.09 5.862 6.026 18.317-.247 36.641-.25 54.96-.075 6.572.062 12.423-1.653 18.028-4.896 14.17-8.197 21.06-24.215 17.143-40.14-3.794-15.43-18.02-27.381-33.837-27.655-19.315-.333-38.64-.055-57.958-.202-3.448-.026-4.21 1.412-4.143 4.487.155 6.992.048 13.99.048 21.985m-35.387-5c-.002-5.657.237-11.332-.162-16.961-.11-1.552-1.94-4.01-3.294-4.244-3.385-.586-6.985-.436-10.434-.03-5.852.687-10.785 6.158-10.81 11.842-.071 16.307-.15 32.617.127 48.92.044 2.543 1.54 5.328 3.051 7.529 4.003 5.827 10.324 4.026 16.006 4.397 3.488.228 5.084-.587 5.075-4.563-.034-15.296.266-30.593.441-46.89"/><path fill="#35464E" d="M522.033 373.228c-1.658 2.281-3.316 4.563-5.813 6.813-9.23-.033-17.62-.106-26.01.002-2.711.034-5.417.542-8.125.833-7.055.168-14.11.318-21.164.513-4.647.128-9.294.484-13.938.434-3.916-.042-7.824-.692-11.742-.77-7.03-.138-14.066-.063-21.1-.05-5.272.009-9.381-1.728-11.097-8.033a71885 71885 0 0 1-.046-68c-.234-4.752 2.261-7.276 6.715-8.14 3.228-.625 6.47-1.178 10.476-1.5 9.77.397 18.77.53 27.77.664.471 0 .942 0 1.954-.042.542-.042.926-.073 1.405-.022 8.225.05 15.97.047 24.009.119.491.037.69.001.888-.035 11.953.33 23.926.358 35.853 1.113 6.533.414 9.713 1.239 9.915 7.825.011 23.333.03 45.805.05 68.276M402.984 49.83c.778-3.962 3.944-5.459 7.992-6.864 34.932.048 69.015.04 103.099.033 4.222.632 6.737 3.154 7.913 7.994.007 21.126-.005 41.411.062 61.697.005 1.74.538 3.478.826 5.217-.527 5.01-3.24 8.042-9.023 9.069-13.426.082-26.02.144-39.097.165-8.326.003-16.17.048-24.458.013-13.109-.108-25.775-.136-38.441-.164-3.863-1.232-7.84-2.322-8.839-7.942.004-23.634-.015-46.426-.034-69.218"/><path fill="#36464E" d="M64.013 39.824c2.817-8.092 6.434-9.613 14.038-9.742 14.349-.244 28.705-.096 43.058-.096 16.302 0 32.61.264 48.905-.072 9.051-.186 15.753 5.676 15.216 15.104-.833 14.617-.212 29.317-.215 44.92-.019 3.75-.035 6.562-.04 9.376-.017 11.755-3.955 15.647-15.845 15.656-10.757.008-21.513.016-32.724.031-8.152.013-15.85.02-23.99.016-4.112-.276-7.782-.542-11.508-1.296-.069-10.302-.122-20.117-.07-29.93.015-2.824-.41-4.972-3.947-4.926-10.634.14-21.269.211-32.161.152-.418-.278-.577-.4-.74-.959.005-13.036.014-25.635.023-38.234M185.004 332.98c.008 16.234.025 32.469.021 48.703-.001 6.428-1.578 8.393-9.04 10.326-34.944-.01-69.035 0-103.125.01-5.607.137-7.785-3.321-8.704-9.028-.117-13.083-.133-25.344.3-37.748 10.427-.193 20.411-.469 30.38-.193 4.753.132 6.08-1.77 6.035-6.136a503 503 0 0 1 .61-30.921c4.101-.004 7.744-.011 11.864-.014 8.165.013 15.853.02 24.017.028 11.591 0 22.707-.08 33.822.026 8.578.082 13.559 5.1 13.78 13.63.09 3.481.079 6.965.086 10.665-.027.216-.046.651-.046.651"/><path fill="#E43834" d="M534.88 241.03c9.893-1.344 19.816-2.513 29.671-4.098 5.91-.95 11.716-2.55 17.982-3.444.371 37.331.329 74.25.287 111.168 0 0-.444.19-1.142.24-15.725.021-30.75-.008-45.777-.038l-.355.05s-.293-.208-.335-.88c-.069-9.16-.097-17.646-.12-26.132q-.108-38.433-.212-76.866m47.97-51.001c-7.175-1.343-14.344-2.72-21.526-4.02-8.876-1.607-17.763-3.15-26.991-4.897-.305-5.182-.263-10.189.146-15.896.466-4.014.648-7.328.65-10.642.02-24.896.003-49.792-.003-74.688 0 0-.037-.27.488-.486 15.1-.252 29.674-.288 44.522-.063 1.12 1.881 2.703 3.499 2.708 5.121.108 35.19.04 70.38.006 105.57"/><path fill="#566C76" d="m136.86 114.994 32.27-.024c11.89-.009 15.828-3.901 15.846-15.656.004-2.814.02-5.627.031-8.913 15.761-.43 31.522-.389 48.004-.01 9.441.139 18.16-.059 26.88-.256 5.108.313 10.216.627 15.594 1.293-5.262 2.92-10.725 5.65-16.338 8.029-17.207 7.292-34.516 14.346-51.686 21.725-5.03 2.162-9.728 5.1-14.578 7.683-.373.104-.746.208-1.787.264-3.796.958-7.002 1.768-10.038 3-14.685 5.965-29.325 12.043-44.03 17.593-.089-11.9-.128-23.314-.168-34.728"/><path fill="#556C76" d="M450.74 127.234c7.845-.045 15.69-.09 24.097.1.782.411 1.005.581 1.233.746-.044.459-.089.918-.488 1.97-.42 9.366-.487 18.138-.553 26.91.309 4.685.617 9.37.452 14.539a203 203 0 0 1-24.458-2.967c-.117-14.078-.2-27.688-.282-41.298"/><path fill="#E97A5B" d="M16.05 345.075c-.344-1.333-.99-2.666-.991-4-.055-86.568-.058-173.136-.055-259.705 0-.657.151-1.314.63-2.177.398-.207.417-.19.47.149.132.79.21 1.242.19 2.142-.077 3.845-.058 7.243-.103 11.065-.024 2.728.017 5.03.005 7.767-.023 1.885.008 3.336-.023 5.216-.023 2.74.014 5.052-.001 7.796-.012 1.88.028 3.328.004 5.23-.026 28.082.011 55.71.01 83.704-.013.858.015 1.348-.019 2.294-.022 36.75.016 73.046.002 109.814-.019 8.218.016 15.963-.01 24.134-.078 2.458-.095 4.49-.118 6.532-.008.012.01.039.01.039"/><path fill="#AF553A" d="M193.276 128.925c4.457-2.642 9.154-5.58 14.185-7.743 17.17-7.379 34.479-14.433 51.686-21.725 5.613-2.379 11.076-5.108 16.808-7.96 6.047-.269 11.894-.255 17.965.102-11.348-1.89-20.623 4.611-30.446 8.663-17.19 7.089-34.147 14.737-51.284 21.957-6.05 2.548-12.34 4.527-18.914 6.706"/><path fill="#E43834" d="M224.808 307.146c1.429.297 2.961.355 4.27.926 16.651 7.264 33.17 14.848 49.977 21.727 3.704 1.516 8.404.64 12.647.781 1.934.065 3.874-.077 6.072.179-6.065.908-12.39 1.512-19.248 1.874-.532-.24-.749-.577-.87-.883-12.478-5.812-24.866-11.253-37.18-16.854-5.3-2.412-10.45-5.157-15.668-7.75"/><path fill="#B75944" d="M583.02 190.249c-.137-35.41-.069-70.6-.177-105.79-.005-1.623-1.588-3.24-2.317-5.188.905-.31 1.69-.292 2.475-.275.33 1.648.945 3.296.949 4.944.075 35.37.083 70.739.153 106.575-.271.296-.592.125-1.084-.266"/><path fill="#C84C25" d="M446.39 253.935c-.05-.604.243-1.541.654-1.596 15.846-2.13 31.702-4.183 47.56-6.221.286-.037.611.22 1.196.65-6.281 1.037-12.839 1.767-19.885 2.881-.724.55-.896.768-1.447 1.092-8.17 1.19-15.895 2.324-23.821 3.422-.2-.037-.608-.008-.608-.008a81 81 0 0 1-3.649-.22"/><path fill="#B85A45" d="M583.221 344.529c-.359-36.792-.317-73.71-.321-111.1.492-.78 1.03-1.088 1.891-1.395-.048 2.063-.737 4.124-.741 6.186-.071 33.25-.048 66.502-.074 99.753a28.8 28.8 0 0 1-.755 6.556"/><path fill="#EDAFA7" d="M534.664 241.056c.285 25.596.355 51.218.426 76.84.024 8.486.052 16.973.068 25.96-.389-1-1.096-2.498-1.099-3.998-.062-32.599-.046-65.197-.04-98.25.004-.454.43-.526.645-.552"/><path fill="#5F686D" d="M73.103 392.387c33.847-.378 67.938-.387 102.503-.387-.707.339-1.888.951-3.071.954-32.576.056-65.152.052-97.727.046-.488 0-.975-.16-1.705-.613"/><path fill="#6D787E" d="M513.83 42.64c-33.839.367-67.922.374-102.485.367.542-.35 1.563-.98 2.584-.981 32.73-.036 65.46-.012 98.19.016.488 0 .977.156 1.71.598"/><path fill="#B5BEC7" d="M277.777 332.056s.217.336.295.52c-26.337.261-52.753.34-79.17.416-4.32.012-8.641.007-13.43-.001-.468-.012-.45-.447.04-.698 31.082-.246 61.673-.242 92.265-.237"/><path fill="#C15C3C" d="M451.058 169c7.983.994 15.966 1.988 24.39 2.957 4.691 1.095 8.942 2.216 13.411 3.67-12.835-1.184-25.89-2.689-38.94-4.226-1.786-.21-3.552-.582-5.574-1.171 1.57-.35 3.385-.406 5.721-.754.677-.354.834-.415.992-.477"/><path fill="#F1B0AA" d="M534.715 80.078c.416 24.704.432 49.6.413 74.496a88 88 0 0 1-.604 10.229c-.287-27.986-.253-56.26.191-84.725"/><path fill="#ADB7BE" d="M451.023 168.532c-.123.529-.28.59-.69.662-.253-13.465-.253-26.94-.253-41.41-12.722 0-25.266 0-38.017-.397 12.46-.369 25.126-.34 38.235-.233.526 13.69.608 27.3.725 41.378"/><path fill="#656F75" d="M402.603 50.06c.4 22.562.419 45.354.408 68.626-.36-.196-.98-.873-.98-1.55.027-22.281.114-44.563.572-67.076"/><path fill="#565D63" d="M522.343 372.914c-.33-22.157-.349-44.629-.343-67.58.353.373.964 1.225.966 2.078.053 21.25.044 42.502.027 63.753 0 .479-.221.957-.65 1.75"/><path fill="#616B71" d="M402.644 305.216c.362 22.145.37 44.535.362 67.401-.345-.034-.966-.545-.965-1.055.049-22.034.153-44.067.603-66.346"/><path fill="#565D63" d="M522.926 117.448c-.338-1.28-.87-3.018-.876-4.758-.067-20.286-.055-40.571-.046-61.336.343 1.203.946 2.885.951 4.567.058 20.356.028 40.712-.03 61.527"/><path fill="#FEC1B1" d="M582.81 78.603c-.594.376-1.379.359-2.556.407-14.967.102-29.541.138-44.55.289.324-.357 1.081-1.238 1.839-1.238 15.025-.012 30.05.078 45.267.542"/><path fill="#FFC6AB" d="M16.02 78.988c1.46-.331 2.93-.947 4.404-.954 13.895-.071 27.791-.038 42.118.12.431.155.388.581.408.691s.05.332-.414.28c-15.805-.074-31.145-.099-46.485-.123 0 0-.02-.016-.031-.014"/><path fill="#FFF" d="M62.985 346.036c-15.529-.056-31.057-.112-46.76-.565-.175-.396-.192-.423.28-.484 15.8.022 31.13.104 46.428.403-.03.216.052.646.052.646"/><path fill="#D3D7DC" d="M474.911 250.685c.108-.268.28-.486.715-.72.263 14.997.327 30.063.49 45.589-.1.496-.298.532-.776.028-.33-15.326-.38-30.111-.429-44.897"/><path fill="#FFF" d="M536.06 345.286c14.867-.398 29.893-.369 45.38-.348.027.344-.407 1.007-.84 1.006-14.793-.038-29.587-.139-44.54-.658"/><path fill="#AAB6BD" d="M450.035 254.61c.004-.455.411-.484.648.001.21 14.08.183 27.674.156 41.268 0 0-.384.031-.573.07-.205-13.603-.22-27.244-.23-41.34"/><path fill="#B5B6B9" d="M62.93 78.735s.043-.426.08-.637c.098-12.754.157-25.298.61-38.057.384 12.382.375 24.981.118 38.14-.435.559-.621.556-.808.554"/><path fill="#ADB4BB" d="M476.534 128.054c-.692-.139-.915-.309-1.215-.678 12.513-.256 25.108-.318 38.167-.378-1.02.334-2.502.94-3.99.952-10.832.093-21.666.066-32.962.104"/><path fill="#B3B5BE" d="M62.995 346.502c-.01-.466-.093-.896.212-1.122.47-.15.636-.071.801.007.015 12.26.03 24.52.024 37.258-.36-.853-.985-2.18-.994-3.512-.076-10.72-.036-21.443-.043-32.63"/><path fill="#4B575D" d="M482.544 380.926c2.25-.341 4.955-.849 7.666-.883 8.39-.108 16.78-.035 25.674 0-.88.34-2.262.907-3.648.917-9.744.07-19.489.025-29.692-.034"/><path fill="#F0F6F6" d="M447.812 295.578c-8.852.283-17.853.15-27.19-.181 8.79-.21 17.916-.222 27.19.181"/><path fill="#D1D3DA" d="M475.428 156.785c-.333-8.597-.267-17.369.127-26.39a321 321 0 0 1-.127 26.39"/><path fill="#ACB9C0" d="M259.432 90.08c-8.26.252-16.98.45-25.993.367 8.316-.326 16.925-.374 25.993-.367"/><path fill="#41251F" d="M269.085 201c0-7.495.107-14.493-.048-21.485-.068-3.075.695-4.513 4.143-4.487 19.319.147 38.643-.131 57.958.202 15.818.274 30.043 12.225 33.837 27.655 3.916 15.925-2.974 31.943-17.143 40.14-5.605 3.243-11.456 4.958-18.028 4.896-18.319-.174-36.643-.172-54.96.075-4.678.063-5.96-1.443-5.862-6.026.29-13.485.103-26.98.103-40.97"/><path fill="#E43834" d="M137.05 153.08c-.022 37.418-.009 74.834-.135 112.25-.01 3.11.904 4.913 3.797 6.081 3.465 1.399 6.782 3.163 9.852 5.15-4.748-1.035-9.183-2.45-13.84-4.089-8.09-3.664-15.957-7.103-24-10.825-2.546-1.486-4.812-3.132-7.328-3.737-1.685-.405-3.726.67-5.931 1.022-.033-3.286.525-6.514.509-9.739-.142-28.201-.386-56.402-.272-84.455 5.503 2.54 9.138-1.065 13.513-3.163 7.765-2.981 15.182-5.946 22.906-8.803.515.175.722.242.93.309"/><path fill="#576C75" d="M136.946 272.697c4.435 1.415 8.87 2.83 13.673 4.21.716.101 1.064.236 1.847.675 8.809 3.884 17.182 7.462 25.554 11.04.446.122.892.243 1.863.631a785 785 0 0 0 11.135 4.29c.607.244 1.213.488 2.315 1.07 5.548 2.306 10.6 4.277 15.652 6.248 0 0 .342.25.665.606 4.338 1.946 8.353 3.536 12.369 5.125.691.174 1.383.348 2.432.538 5.575 2.61 10.724 5.354 16.025 7.766 12.314 5.601 24.702 11.042 37.18 16.854-30.47.301-61.062.297-92.116.327-.497-3.449-.487-6.933-.577-10.415-.22-8.528-5.201-13.547-13.779-13.629-11.115-.106-22.231-.025-33.806-.495-.45-11.927-.442-23.384-.432-34.84"/><path fill="#43241D" d="M233.698 197c-.175 15.797-.475 31.094-.44 46.39.008 3.976-1.588 4.79-5.076 4.563-5.682-.37-12.003 1.43-16.006-4.397-1.512-2.201-3.007-4.986-3.05-7.53-.278-16.302-.199-32.612-.128-48.919.025-5.684 4.958-11.155 10.81-11.843 3.449-.405 7.049-.555 10.434.03 1.354.234 3.184 2.693 3.294 4.245.399 5.63.16 11.304.162 17.461"/><path fill="#AF553A" d="M137.363 152.914c-.52.1-.727.033-1.166-.405.14-1.014.51-1.657.88-2.3 14.656-6.037 29.296-12.115 43.981-18.08 3.036-1.232 6.242-2.042 9.758-2.924-6.7 3.405-13.727 6.825-20.89 9.936-10.7 4.65-21.496 9.082-32.563 13.773"/><path fill="#E43834" d="M177.963 288.298c-8.315-3.254-16.688-6.832-25.216-10.731a490 490 0 0 1 25.216 10.731m30.967 12.22c-4.997-1.628-10.049-3.599-15.268-5.88a168 168 0 0 1 15.268 5.88m13.005 5.762c-3.932-1.277-7.947-2.867-12.074-4.788 3.922 1.271 7.956 2.873 12.074 4.788m-31.002-13.042c-3.451-1.037-6.988-2.377-10.702-4.019a92 92 0 0 1 10.702 4.02"/><path fill="#546C76" d="M451.318 295.93c-.452-13.645-.425-27.24-.435-41.282 7.69-1.583 15.416-2.717 23.585-3.907.493 14.73.543 29.515.58 44.768-7.76.468-15.505.47-23.73.421"/><path fill="#E43834" d="M99.374 164.59c.214 28.2.458 56.402.6 84.603.016 3.225-.542 6.453-.414 10.072.358.846.295 1.3-.143 1.85-.716 1.8-1.348 3.503-1.352 5.208-.065 23.858-.111 47.717.027 71.575.021 3.739-.768 5.226-4.923 5.192a3904 3904 0 0 0-70.076.033c-4.051.039-6.214-1.128-6.874-5.045-.034-7.745-.069-15.49.195-24.02.391-1.437.564-2.092.564-2.746.014-34.472.022-68.945-.017-103.417-.002-1.265-.478-2.53-.733-3.794-.027-.49-.055-.981.202-2.15.376-1.334.547-1.988.548-2.642.014-25.803.024-51.606-.017-77.408-.002-1.267-.47-2.532-.721-3.798-.04-1.447-.08-2.895.165-5.055.134-3.122-.019-5.533-.171-7.944-.03-1.452-.06-2.903.19-5.07.132-3.113-.018-5.511-.168-7.91-.02-3.397-.04-6.795.411-10.729 2.413-.818 4.353-1.33 6.297-1.342 11.6-.076 23.2-.002 34.798-.074 1.748-.011 3.493-.522 5.238-.802 0 0-.03-.222-.05-.332.167-.108.353-.105.791-.226.412-.002.571.12 1.092.778 1.89.887 3.416 1.522 4.95 1.541 8.133.102 16.268.119 24.4.011 2.682-.035 3.866.744 3.887 3.65.07 9.933.56 19.866.535 29.797-.038 14.913-.41 29.825-.522 44.738-.01 1.308.85 2.622 1.339 4.188.005.592-.022.93-.048 1.268"/><path fill="#283136" d="M137.028 149.722c-.321 1.13-.692 1.773-1.139 2.68-7.492 3.227-14.909 6.192-22.653 8.745-.345-15.648-.362-30.884-.38-46.12 7.7-.006 15.398-.013 23.55-.026.494 11.407.533 22.82.622 34.721"/><path fill="#5E6A70" d="M112.415 115.017c.459 15.246.476 30.482.472 46.146-4.047 2.51-7.682 6.115-13.185 3.575-.302-.486-.275-.824-.04-1.75.303-14.903.37-29.216.523-43.529.02-1.752.508-3.5.78-5.25 3.67.266 7.339.532 11.45.808"/><path fill="#E43834" d="M100.908 113.72c-.215 2.239-.704 3.987-.723 5.74-.154 14.312-.22 28.625-.554 43.273-.697-.977-1.558-2.291-1.548-3.6.112-14.912.484-29.824.522-44.737.025-9.931-.464-19.864-.535-29.797-.02-2.906-1.205-3.685-3.887-3.65-8.132.108-16.267.091-24.4-.01-1.534-.02-3.06-.655-4.693-1.385 10.532-.478 21.167-.549 31.801-.689 3.536-.046 3.962 2.102 3.947 4.926-.052 9.813.001 19.628.07 29.93"/><path fill="#283136" d="M136.724 272.472c.212 11.682.203 23.139.178 35.064-7.704.462-15.392.456-23.538-.022-.46-15.509-.462-30.546-.465-45.584 7.868 3.44 15.735 6.878 23.825 10.542"/><path fill="#5F6A6F" d="M112.725 261.647c.177 15.32.18 30.358.163 45.862-3.663.473-7.306.48-11.683.177-.84-2.792-1.014-5.274-1.042-7.758-.144-12.97-.25-25.94-.37-38.91.062-.454.125-.907.091-1.693 1.786-.746 3.827-1.82 5.512-1.415 2.516.605 4.782 2.251 7.329 3.737"/><path fill="#E43834" d="M99.417 261.115c.495 12.873.602 25.843.746 38.813.028 2.484.201 4.966.583 7.755.207 10.615.018 20.924.125 31.231.045 4.366-1.282 6.268-6.035 6.136-9.969-.276-19.953 0-30.38.193-.613.066-.779-.012-1.218-.08-15.604-.072-30.933-.154-46.727-.187-.447-1.982-.43-4.014-.353-6.472.72 3.49 2.884 4.658 6.935 4.619 23.357-.227 46.718-.226 70.076-.033 4.155.034 4.944-1.453 4.923-5.192-.138-23.858-.092-47.717-.027-71.575.004-1.705.636-3.407 1.352-5.208m-83.25-56.559c.316.81.792 2.074.794 3.339a66019 66019 0 0 1 .017 103.417c0 .654-.173 1.309-.51 2.275-.285-35.985-.323-72.28-.301-109.031m.009-85.998c.315.81.783 2.076.785 3.343.041 25.802.031 51.605.017 77.408 0 .654-.172 1.308-.509 2.274-.282-27.315-.319-54.943-.293-83.025m46.36-39.432c-1.281.33-3.026.842-4.774.853-11.599.072-23.199-.002-34.798.074-1.944.013-3.884.524-6.2.894-.45-.363-.528-.814-.66-1.605 15.287-.316 30.627-.291 46.432-.216M16.191 92.549c.215 1.974.365 4.372.286 7.052-.269-2.021-.31-4.324-.286-7.052m-.018 12.983a52 52 0 0 1 .284 7.084c-.27-2.032-.307-4.344-.284-7.084"/></svg>`;

@Component({
  selector: 'app-animation',
  standalone: true,
  imports: [CommonModule, DatePipe, CarTooltipComponent],
  templateUrl: './animation.component.html',
})
export class AnimationComponent implements AfterViewInit, OnDestroy {
  @ViewChild('animationCanvas', { static: true }) canvas!: ElementRef<HTMLCanvasElement>;

  private ctx!: CanvasRenderingContext2D;
  private drivers: any[] = [];
  private trajectories = new Map<number, any[]>();
  private carImages = new Map<number, HTMLImageElement>();
  private trackTrajectory: any[] = []; // For drawing the track outline
  private allLocationData: any[] = []; // Store all location data from the API call
  private trackLocked = false; // Prevent track from changing after initial load

  private animationFrameId: number | null = null;
  private currentFrame = 0;
  private isPaused = false;

  private subscriptions: Subscription[] = [];

  // Zoom and Pan properties
  private zoom = 1;
  private panX = 0;
  private panY = 0;
  private isDragging = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private minZoom = 0.1;
  private maxZoom = 5;

  // Configuration and timing
  private showAllDrivers = true; // Flag to control number of drivers
  private singleDriverNumber = 1; // Driver to show when showAllDrivers is false
  
  // Time-based animation properties
  private sessionStartTime: Date | null = null;
  private sessionEndTime: Date | null = null;
  private raceStartTime: Date | null = null; // Actual race start time
  private currentSimulationTime: Date | null = null;
  private lastUpdateTime: number = 0;
  private speedMultiplier: number = 10;

  // Expose observables for template
  currentTime$!: Observable<Date | null>;
  sessionName$!: Observable<string>;

  // Speed options reused from controls
  speedOptions = [0.25,0.5,1,2,5,10,20,50];

  // Tooltip properties
  showTooltip = false;
  tooltipX = 0;
  tooltipY = 0;
  hoveredDriverData: any = null;
  private carPositions = new Map<number, { 
    x: number, 
    y: number, 
    size: number,
    circleX: number,
    circleY: number,
    circleRadius: number,
    detectionRadius: number
  }>(); // Track car positions for hover detection & debug
  private tooltipLockedDriver: number | null = null; // When set, tooltip stays visible
  private showHoverDebug = true; // Toggle with 'h'
  private hoverDebounceTimeout: number | null = null; // For debouncing hover events

  // Race sequence tracking
  private raceSequenceStarted = false;
  private visibilityMap: Record<number, boolean> = {};

  // Lap data
  private lapData: any[] = [];
  private lastLapChunkLoaded = -1;
  private leaderDriverCache: number | null = null;
  currentLapInfo$ = new BehaviorSubject<{ lapNumber: number; lapDuration?: number; speedTrap?: number } | null>(null);

  constructor(
    private openf1ApiService: Openf1ApiService,
    public animationControlService: AnimationControlService,
    private positionService: PositionService,
    private raceCommentaryService: RaceCommentaryService,
    private loadingService: LoadingService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private driverVisibility: DriverVisibilityService,
    private lapDataService: LapDataService
  ) {
    // Initialize speed multiplier from the service
    this.speedMultiplier = this.animationControlService.getSpeedMultiplier();
    this.currentTime$ = this.animationControlService.currentTime$;
    this.sessionName$ = merge(of(null), this.animationControlService.sessionChanged$).pipe(
      switchMap(() => this.openf1ApiService.getSessionInfo()),
      map((sessions: any[]) => {
        const s = sessions && sessions.length ? sessions[0] : null;
        return s ? `${s.circuit_short_name} - ${s.session_name}` : '';
      }),
      shareReplay(1)
    );
  }

  // Template helper methods
  getSpeedMultiplier(): number { return this.animationControlService.getSpeedMultiplier(); }
  getIsPlaying(): boolean { return this.animationControlService.getIsPlaying(); }
  playPause(): void { 
    if (this.getIsPlaying()) {
      this.animationControlService.pause();
    } else {
      this.animationControlService.start();
      // Only trigger race start sequence on the first start
      if (!this.raceSequenceStarted) {
        this.startRaceSequence();
        this.raceSequenceStarted = true;
      }
    }
  }
  restart(): void { 
    this.animationControlService.stop(); 
    // Reset race sequence flag so it can be triggered again on next start
    this.raceSequenceStarted = false;
  }
  increaseSpeed(): void {
    const current = this.animationControlService.getSpeedMultiplier();
    const idx = this.speedOptions.findIndex(s => s === current);
    if (idx < this.speedOptions.length -1) {
      this.animationControlService.setSpeedMultiplier(this.speedOptions[idx+1]);
    }
  }
  decreaseSpeed(): void {
    const current = this.animationControlService.getSpeedMultiplier();
    const idx = this.speedOptions.findIndex(s => s === current);
    if (idx>0) {
      this.animationControlService.setSpeedMultiplier(this.speedOptions[idx-1]);
    }
  }

  ngAfterViewInit(): void {
    const canvasEl = this.canvas.nativeElement;
    const context = canvasEl.getContext('2d');
    if (!context) {
      throw new Error('Could not get canvas context');
    }
    this.ctx = context;
    
    // Setup responsive canvas
    this.setupResponsiveCanvas();
    this.setupCanvasEventListeners();
    
    this.loadAllDriverData();

    this.subscriptions.push(
      this.animationControlService.start$.subscribe(() => this.startAnimation()),
      this.animationControlService.pause$.subscribe(() => this.pauseAnimation()),
      this.animationControlService.stop$.subscribe(() => this.stopAnimation()),
      this.animationControlService.toggleShowAllDrivers$.subscribe(() => this.toggleShowAllDrivers()),
      this.animationControlService.speedChanged$.subscribe((speed) => this.onSpeedChanged(speed)),
      this.animationControlService.timeSeek$.subscribe((time) => this.seekToTime(time)),
      this.animationControlService.jumpToRaceStart$.subscribe(() => this.jumpToRaceStart()),
      this.animationControlService.raceStartDetected$.subscribe((raceInfo) => this.handleRaceStartDetected(raceInfo)),
      this.animationControlService.speedMultiplier$.subscribe((speed) => {
        this.speedMultiplier = speed;
      }),
      this.animationControlService.sessionChanged$.subscribe(() => {
        this.drivers = [];
        this.trajectories.clear();
        this.carImages.clear();
        this.trackTrajectory = [];
        this.sessionStartTime = null;
        this.sessionEndTime = null;
        this.raceStartTime = null;
        this.currentSimulationTime = null;
        this.stopAnimation();
        // Ensure loading modal is hidden when session changes
        this.loadingService.hide();
        this.loadAllDriverData();
      }),
      this.driverVisibility.visibility$.subscribe((mapRec: Record<number, boolean>) => {
        this.visibilityMap = mapRec;
        if (this.currentSimulationTime && this.ctx) {
          this.ctx.clearRect(0, 0, this.canvas.nativeElement.width, this.canvas.nativeElement.height);
          this.drawTrack();
          this.updateCarsAtCurrentTime();
        }
      })
    );
  }

  /**
   * Force repaint of cars - useful for debugging
   * Can be called from browser console with: document.querySelector('app-animation').forceRepaintCars()
   */
  forceRepaintCars(): void {
    console.log('🔄 Force repainting cars...');
    
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.nativeElement.width, this.canvas.nativeElement.height);
    
    // Redraw track
    this.drawTrack();
    
    // Update cars
    this.updateCarsAtCurrentTime();
    
    // Ensure loading modal is hidden after force repaint
    this.loadingService.hide();
    
    console.log('✅ Force repaint completed');
  }

  /**
   * Debug method to check component state
   */
  debugCarState(): void {
    console.log('🔍 Car State Debug:');
    console.log('- Current simulation time:', this.currentSimulationTime?.toISOString());
    console.log('- Number of drivers:', this.drivers.length);
    console.log('- Car images loaded:', this.carImages.size);
    console.log('- Trajectories loaded:', this.trajectories.size);
    console.log('- Track trajectory points:', this.trackTrajectory.length);
    console.log('- All location data points:', this.allLocationData.length);
    console.log('- Canvas dimensions:', this.canvas.nativeElement.width, 'x', this.canvas.nativeElement.height);
    console.log('- Canvas context:', !!this.ctx);
    
    this.drivers.forEach(driver => {
      const trajectory = this.trajectories.get(driver.driver_number);
      const carImage = this.carImages.get(driver.driver_number);
      console.log(`  Driver ${driver.driver_number}: ${trajectory?.length || 0} points, image: ${carImage ? 'loaded' : 'missing'}`);
    });
  }

  /**
   * Initialize car painting when everything is ready
   * Can be called from browser console to fix missing cars
   */
  initializeCarPainting(): void {
    console.log('🚗 Initializing car painting...');
    
    // Check prerequisites
    if (!this.ctx) {
      console.error('❌ Canvas context not available');
      return;
    }
    
    if (!this.currentSimulationTime) {
      console.error('❌ No current simulation time set');
      return;
    }
    
    if (this.drivers.length === 0) {
      console.error('❌ No drivers loaded');
      return;
    }
    
    if (this.carImages.size === 0) {
      console.error('❌ No car images loaded');
      return;
    }
    
    console.log('✅ All prerequisites met, painting cars...');
    this.forceRepaintCars();
    
    // Ensure loading modal is explicitly hidden
    console.log('🔄 Hiding loading modal after manual car initialization');
    this.loadingService.hide();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    
    // Clean up hover debounce timeout
    if (this.hoverDebounceTimeout) {
      clearTimeout(this.hoverDebounceTimeout);
    }
    
    // Clean up canvas event listeners
    const canvas = this.canvas.nativeElement;
    if (canvas) {
      canvas.removeEventListener('wheel', () => {});
      canvas.removeEventListener('mousedown', () => {});
      canvas.removeEventListener('mousemove', () => {});
      canvas.removeEventListener('mouseup', () => {});
      canvas.removeEventListener('mouseleave', () => {});
    }
  }

  public toggleShowAllDrivers(): void {
    this.showAllDrivers = !this.showAllDrivers;
    this.drivers = [];
    this.trajectories.clear();
    this.carImages.clear();
    this.trackTrajectory = [];
    this.stopAnimation();
    this.loadAllDriverData();
  }

  loadAllDriverData(): void {
    // First get session timing information
    this.openf1ApiService.getSessionTimeBounds().subscribe(bounds => {
      this.sessionStartTime = bounds.startTime;
      this.sessionEndTime = bounds.endTime;
      this.currentSimulationTime = new Date(bounds.startTime);
      // Ensure the animation control service is immediately updated with the start time
      this.animationControlService.setCurrentTime(this.currentSimulationTime);
    });
  this.openf1ApiService.getDrivers().pipe(
      switchMap(drivers => {
        if (this.showAllDrivers) {
          this.drivers = drivers;
        } else {
          const singleDriver = drivers.find(d => d.driver_number === this.singleDriverNumber);
          this.drivers = singleDriver ? [singleDriver] : [];
        }

        if (this.drivers.length === 0) {
          return of([]);
        }

        // Fetch half-race trajectory for one driver (always driver_number 1 by default) for track outline (cached)
        const trackDriverNumber = this.singleDriverNumber; // can be adjusted if needed
        return this.openf1ApiService.getHalfRaceTrackDriverData(trackDriverNumber).pipe(
          switchMap(trackData => {
            // Set track trajectory immediately
            if (!this.trackLocked) {
              this.trackTrajectory = trackData.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
              this.trackLocked = true; // Lock after first assignment
              console.log(`🛣️ Track trajectory points (half race, locked): ${this.trackTrajectory.length}`);
              this.drawTrack();
            }
            // Then continue with normal all-driver initial data load (first chunk only)
            return this.openf1ApiService.getAllDriversLocationData().pipe(
              switchMap(locationData => {
                // Also load car data
                return this.openf1ApiService.getAllDriversCarData().pipe(
                  map(carData => ({ locationData, carData }))
                );
              })
            );
          })
        );
      })
  ).subscribe((result: any) => {
      const allLocationData = result.locationData || result;
      const allCarData = result.carData || [];
      
      if (allLocationData.length === 0) {
        return;
      }

      console.log(`📊 Processing ${allLocationData.length} location data points from first 5 minutes`);

      // Store all location data for track drawing and simulation
      this.allLocationData = allLocationData;
      
      console.log(`🚗 Loaded ${allCarData.length} car data points for enhanced visualization`);

      // Group location data by driver and filter for our drivers
      this.drivers.forEach(driver => {
        const driverLocations = allLocationData
          .filter((loc: any) => loc.driver_number === driver.driver_number)
          .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        this.trajectories.set(driver.driver_number, driverLocations);
        
        console.log(`🏎️ Driver ${driver.driver_number} (${driver.name_acronym || driver.broadcast_name}): ${driverLocations.length} location points`);
      });

  // Track already set from half-race cached data; do not override here.

      const imageLoadPromises = this.drivers.map(driver => {
        return new Promise<void>(resolve => {
            // Replace the #E43834 color with the team color
            const teamColor = driver.car_color || '#E43834';
            const coloredSvg = CAR_SVG.replace(/#E43834/g, teamColor);
            const blob = new Blob([coloredSvg], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            const image = new Image();
            image.src = url;
            image.onload = () => {
                this.carImages.set(driver.driver_number, image);
                URL.revokeObjectURL(url);
                resolve();
            };
        });
      });

      Promise.all(imageLoadPromises).then(() => {
        console.log('🎨 All car images loaded successfully');
        
        // Detect race start time
        this.detectRaceStart();
        
        // Clear canvas before initial paint
        this.ctx.clearRect(0, 0, this.canvas.nativeElement.width, this.canvas.nativeElement.height);
        
        // Draw track first
        this.drawTrack();
        
        // Update cars at the initial time - this should make cars visible immediately
        console.log('🏎️ Painting cars at initial time:', this.currentSimulationTime?.toISOString());
        this.updateCarsAtCurrentTime();
        
        // Ensure the time display shows the start time
        if (this.currentSimulationTime) {
          this.animationControlService.setCurrentTime(this.currentSimulationTime);
        }
        
        console.log('✅ Initial car painting completed - cars should be visible now');
        
        // Explicitly hide loading modal after car painting is complete
        console.log('🔄 Hiding loading modal after car painting completion');
        this.loadingService.hide();
        
        // Add a safety mechanism: force repaint after a short delay to ensure cars are visible
        setTimeout(() => {
          console.log('🔄 Safety repaint after 1 second...');
          this.forceRepaintCars();
          // Ensure loading is hidden in safety timer too
          this.loadingService.hide();
        }, 1000);
        
        // Another safety check after 3 seconds
        setTimeout(() => {
          if (this.carImages.size > 0 && this.drivers.length > 0) {
            console.log('🔄 Safety repaint after 3 seconds...');
            this.forceRepaintCars();
            // Final safety to ensure loading is hidden
            this.loadingService.hide();
          }
        }, 3000);
      }).catch(error => {
        console.error('❌ Error loading car images:', error);
        // Ensure loading modal is hidden even if there's an error
        console.log('🔄 Hiding loading modal due to error');
        this.loadingService.hide();
      });
    });

    // Load session key for lap service & initial lap chunk
    this.openf1ApiService.getSessionInfo().subscribe((sessions: any[]) => {
      const key = sessions && sessions.length ? sessions[0].session_key : null;
      if (key) {
        this.lapDataService.setSessionKey(key);
        this.loadLapChunk(0); // initial laps
      }
    });
  }

  private detectRaceStartTime(): void {
    if (this.trajectories.size === 0) return;

    // Get the first driver's trajectory to analyze
    const firstDriverTrajectory = Array.from(this.trajectories.values())[0];
    if (!firstDriverTrajectory || firstDriverTrajectory.length < 10) return;

    // Look for significant movement indicating race start
    let raceStartDetected = false;
    const minimumMovement = 100; // meters - threshold for significant movement
    const consistentPoints = 3; // Number of consecutive points with good movement

    for (let i = 5; i < firstDriverTrajectory.length - consistentPoints; i++) {
      let consistentMovement = 0;
      
      // Check for consecutive points with significant movement
      for (let j = 0; j < consistentPoints; j++) {
        const currentPoint = firstDriverTrajectory[i + j];
        const prevPoint = firstDriverTrajectory[i + j - 1];
        
        if (currentPoint && prevPoint) {
          // Calculate distance moved between points
          const deltaX = currentPoint.x - prevPoint.x;
          const deltaY = currentPoint.y - prevPoint.y;
          const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
          
          // Check if speed is available and above threshold, or distance moved is significant
          const hasSpeed = currentPoint.speed && currentPoint.speed > 50; // 50 km/h
          const hasMovement = distance > minimumMovement;
          
          if (hasSpeed || hasMovement) {
            consistentMovement++;
          }
        }
      }

      // If we found consistent racing activity, this might be race start
      if (consistentMovement >= consistentPoints) {
        this.raceStartTime = new Date(firstDriverTrajectory[i].date);
        raceStartDetected = true;
        console.log('Race start detected at:', this.raceStartTime);
        break;
      }
    }

    // Fallback: if no clear race start detected, look for first significant activity
    if (!raceStartDetected) {
      // Find first point where there's any meaningful movement
      for (let i = 1; i < Math.min(firstDriverTrajectory.length, 100); i++) {
        const currentPoint = firstDriverTrajectory[i];
        const prevPoint = firstDriverTrajectory[i - 1];
        
        const deltaX = currentPoint.x - prevPoint.x;
        const deltaY = currentPoint.y - prevPoint.y;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        if (distance > 50) { // Any movement > 50 meters
          this.raceStartTime = new Date(currentPoint.date);
          console.log('First movement detected at:', this.raceStartTime);
          break;
        }
      }
    }

    // Final fallback: use session start + 5 minutes
    if (!this.raceStartTime && this.sessionStartTime) {
      this.raceStartTime = new Date(this.sessionStartTime.getTime() + (5 * 60 * 1000));
      console.log('Race start estimated at:', this.raceStartTime);
    }
  }

  startAnimation(): void {
    console.log('🚀 startAnimation() called, current state:', {
      hasAnimationFrame: !!this.animationFrameId,
      hasSessionStart: !!this.sessionStartTime,
      currentTime: this.currentSimulationTime?.toISOString(),
      raceStartTime: this.raceStartTime?.toISOString(),
      driversCount: this.drivers.length,
      carImagesLoaded: this.carImages.size
    });

    if (this.animationFrameId || !this.sessionStartTime) {
      return;
    }

    // Start animation from current time - don't auto-jump to race start
    // Let the formation lap play naturally from the beginning
    console.log('▶️ Starting animation from current time:', this.currentSimulationTime?.toISOString());

    // Ensure cars are painted before starting animation
    console.log('🎨 Ensuring cars are painted before animation starts...');
    this.forceRepaintCars();

    this.isPaused = false;
    this.lastUpdateTime = performance.now();
    this.animate();
  }

  pauseAnimation(): void {
    console.log('⏸️ pauseAnimation() called');
    this.isPaused = true;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    // Redraw the current state so tooltips continue to work while paused
    this.drawTrack();
  }

  stopAnimation(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.sessionStartTime) {
      this.currentSimulationTime = new Date(this.sessionStartTime);
      this.animationControlService.setCurrentTime(this.currentSimulationTime);
      this.updateCarsAtCurrentTime();
    }
    
    // Reset race sequence flag so it can be triggered again on next start
    this.raceSequenceStarted = false;
    
    // Reset dynamic data loading by clearing API service segments
    // This ensures a fresh start when restarting the simulation
    this.clearDynamicDataAndReload();
    
    this.drawTrack();
  }

  onSpeedChanged(speed: number): void {
    this.speedMultiplier = speed;
  }

  seekToTime(targetTime: Date): void {
    this.currentSimulationTime = new Date(targetTime);
    this.animationControlService.setCurrentTime(this.currentSimulationTime);
    this.updateCarsAtCurrentTime();
  this.updateLapInfo();
  }

  jumpToRaceStart(): void {
    if (this.raceStartTime) {
      this.currentSimulationTime = new Date(this.raceStartTime);
      this.animationControlService.setCurrentTime(this.currentSimulationTime);
      this.updateCarsAtCurrentTime();
      console.log('Jumped to race start time:', this.currentSimulationTime);
    } else {
      console.log('Race start time not detected yet');
    }
  }

  private animate(): void {
    if (this.isPaused) {
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
      return;
    }

    if (!this.currentSimulationTime || !this.sessionEndTime) {
      return;
    }

    const now = performance.now();
    const deltaTime = now - this.lastUpdateTime;
    this.lastUpdateTime = now;

    // Calculate how much simulation time has passed
    const simulationDelta = deltaTime * this.speedMultiplier;
    this.currentSimulationTime = new Date(this.currentSimulationTime.getTime() + simulationDelta);

    // Check if we've reached the end of the session
    if (this.currentSimulationTime >= this.sessionEndTime) {
      this.currentSimulationTime = new Date(this.sessionEndTime);
      this.animationControlService.setCurrentTime(this.currentSimulationTime);
      this.updateCarsAtCurrentTime();
      this.stopAnimation();
      return;
    }

    // Update the control service with current time
    this.animationControlService.setCurrentTime(this.currentSimulationTime);

    // Check if we need to load more data dynamically
    this.checkAndLoadMoreDataIfNeeded();
  this.updateLapInfo();

    // Draw the current frame
    this.drawTrack();
    this.updateCarsAtCurrentTime();

    this.animationFrameId = requestAnimationFrame(() => this.animate());
  }

  private checkAndLoadMoreDataIfNeeded(): void {
    if (!this.currentSimulationTime) return;

    // Use the API service to check and load more data
    this.openf1ApiService.checkAndLoadMoreData(this.currentSimulationTime)
      .subscribe(updatedData => {
        if (updatedData.length > this.allLocationData.length) {
          console.log(`🔄 Loaded additional data: ${updatedData.length - this.allLocationData.length} new points`);
          console.log(`📊 Total simulation coverage: ${(updatedData.length / 1000).toFixed(1)}k data points`);
          
          // Update our stored data
          this.allLocationData = updatedData;

          // Update trajectories for each driver with new data
          this.drivers.forEach(driver => {
            const driverLocations = updatedData
              .filter(loc => loc.driver_number === driver.driver_number)
              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            
            this.trajectories.set(driver.driver_number, driverLocations);
            
            console.log(`🏎️ Updated driver ${driver.driver_number}: ${driverLocations.length} total points`);
          });

          // Do NOT update trackTrajectory after it's locked
        }
      });

    // Also check and load car data
    this.openf1ApiService.checkAndLoadMoreCarData(this.currentSimulationTime)
      .subscribe(updatedCarData => {
        if (updatedCarData.length > 0) {
          console.log(`🚗 Car data updated: ${updatedCarData.length} total car data points available`);
        }
      });
  }

  private clearDynamicDataAndReload(): void {
    // Clear the API service's loaded segments
    this.openf1ApiService.clearLoadedSegments();
    
    // Reload the first chunk of data to reset trajectories
    this.openf1ApiService.getAllDriversLocationData().subscribe(allLocationData => {
      if (allLocationData.length === 0) {
        return;
      }

      console.log(`🔄 Reloaded initial data: ${allLocationData.length} location points after restart`);

      // Store all location data for track drawing and simulation
      this.allLocationData = allLocationData;

      // Update trajectories for each driver
      this.drivers.forEach(driver => {
        const driverLocations = allLocationData
          .filter(loc => loc.driver_number === driver.driver_number)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        this.trajectories.set(driver.driver_number, driverLocations);
        
        console.log(`🏎️ Reset driver ${driver.driver_number}: ${driverLocations.length} location points`);
      });

  // Preserve existing locked track; don't overwrite
    });
  // Reset lap data
  this.lapData = [];
  this.lastLapChunkLoaded = -1;
  this.currentLapInfo$.next(null);
  this.loadLapChunk(0);
  }

  private updateCarsAtCurrentTime(): void {
    if (!this.currentSimulationTime) {
      console.log('❌ Cannot update cars: no current simulation time');
      return;
    }

    console.log('🏎️ Updating cars at time:', this.currentSimulationTime.toISOString());
    console.log('🏎️ Number of drivers to paint:', this.drivers.length);
    console.log('🏎️ Number of car images loaded:', this.carImages.size);

    let carsPainted = 0;
    
  this.drivers.forEach(driver => {
      const driverTrajectory = this.trajectories.get(driver.driver_number);
      const carImage = this.carImages.get(driver.driver_number);
      
      console.log(`🏎️ Driver ${driver.driver_number}: trajectory=${driverTrajectory?.length || 0} points, image=${carImage ? 'loaded' : 'missing'}`);
      
      if (this.visibilityMap[driver.driver_number] === false) {
        console.log(`🚫 Skipping hidden driver ${driver.driver_number}`);
        return; 
      }
      if (driverTrajectory && driverTrajectory.length > 0) {
        const position = this.findPositionAtTime(driverTrajectory, this.currentSimulationTime!);
        if (position) {
          console.log(`🎨 Painting car for driver ${driver.driver_number} at position x=${position.x}, y=${position.y}`);
          this.drawCar(position, driver.driver_number);
          carsPainted++;
        } else {
          console.log(`⚠️ No position found for driver ${driver.driver_number} at current time`);
        }
      } else {
        console.log(`⚠️ No trajectory data for driver ${driver.driver_number}`);
      }
    });

    console.log(`✅ Painted ${carsPainted} cars out of ${this.drivers.length} drivers`);

  // Update lap HUD when cars repainted (time advanced)
  this.updateLapInfo();

    // If tooltip is locked, keep it anchored near the driver's number circle
    if (this.tooltipLockedDriver !== null && this.showTooltip) {
      const lockPos = this.carPositions.get(this.tooltipLockedDriver);
      if (lockPos) {
        const canvasRect = this.canvas.nativeElement.getBoundingClientRect();
        // Position tooltip slightly to the right and above the circle
        const screenX = canvasRect.left + lockPos.circleX + 15; // 15px horizontal offset
        const screenY = canvasRect.top + lockPos.circleY - 20;  // 20px above the circle
        this.tooltipX = Math.min(screenX, window.innerWidth - 240);
        this.tooltipY = Math.max(screenY, 10);
      }
    }
  }

  /** Determine leader driver number (cached per tick) */
  private determineLeaderDriver(): number | null {
    if (this.drivers.length === 0) return null;
    let leader: number | null = null;
    let bestPos = Number.MAX_SAFE_INTEGER;
    for (const d of this.drivers) {
      const posData = this.positionService.getDriverPosition(d.driver_number);
      const pos = posData?.position;
      if (pos && pos < bestPos) {
        bestPos = pos;
        leader = d.driver_number;
      }
    }
    if (leader === null) leader = this.drivers[0].driver_number;
    this.leaderDriverCache = leader;
    return leader;
  }

  /** Load a lap chunk by index */
  private loadLapChunk(index: number): void {
    if (index <= this.lastLapChunkLoaded) return;
    this.lapDataService.loadLapDataChunk(index).subscribe(all => {
      this.lapData = all;
      this.lastLapChunkLoaded = Math.max(this.lastLapChunkLoaded, index);
      this.updateLapInfo();
    });
  }

  /** Update current lap info observable */
  private updateLapInfo(): void {
    if (!this.currentSimulationTime || this.lapData.length === 0) return;
    const leader = this.determineLeaderDriver();
    if (leader == null) return;

    // Filter lap entries for leader with date_start <= current simulation time
    const leaderLaps = this.lapData
      .filter(l => l.driver_number === leader && new Date(l.date_start).getTime() <= this.currentSimulationTime!.getTime())
      .sort((a, b) => a.lap_number - b.lap_number);

    if (leaderLaps.length === 0) return;
    const currentLap = leaderLaps[leaderLaps.length - 1];

    // Emit current lap info
    const payload = {
      lapNumber: currentLap.lap_number,
      lapDuration: currentLap.lap_duration,
      speedTrap: currentLap.st_speed
    };
    this.currentLapInfo$.next(payload);

    // Preload next lap chunk if needed
    if (this.lapDataService.shouldPreloadNextChunk(currentLap.lap_number)) {
      const nextChunk = Math.floor((currentLap.lap_number - 1) / 10) + 1;
      this.loadLapChunk(nextChunk);
    }
  }

  private findPositionAtTime(trajectory: any[], targetTime: Date): any | null {
    if (trajectory.length === 0) return null;

    const targetTimestamp = targetTime.getTime();

    // Find the closest position by timestamp
    let closestIndex = 0;
    let closestDiff = Math.abs(new Date(trajectory[0].date).getTime() - targetTimestamp);

    for (let i = 1; i < trajectory.length; i++) {
      const diff = Math.abs(new Date(trajectory[i].date).getTime() - targetTimestamp);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestIndex = i;
      } else {
        // Since trajectory is sorted, we can break early if diff starts increasing
        break;
      }
    }

    return trajectory[closestIndex];
  }

  private setupResponsiveCanvas(): void {
  this.resizeCanvas();
  // Recalculate on window resize
  window.addEventListener('resize', () => this.resizeCanvas());
  }

  private resizeCanvas(): void {
    const canvas = this.canvas.nativeElement;
    const container = canvas.parentElement as HTMLElement | null;
    if (!container) return;

    const containerWidth = container.clientWidth;
    let containerHeight = container.clientHeight;

    // If container has no explicit height yet, derive a proportional one
    if (!containerHeight || containerHeight < 50) {
      containerHeight = Math.min(containerWidth * 0.55, 720);
    }

    // Adjust for detached HUD bar if present above (desktop scenario)
    const rootMain = container.closest('.main-content');
    if (rootMain && window.innerWidth < 1703) {
      const hud = rootMain.querySelector('.detached-hud-bar') as HTMLElement | null;
      if (hud) {
        const hudStyles = getComputedStyle(hud);
        const hudHeight = hud.offsetHeight + parseFloat(hudStyles.marginTop) + parseFloat(hudStyles.marginBottom);
        // Reduce available height only if HUD is absolutely positioned? If not absolute it's already affecting layout.
        const hudIsAbsolute = hudStyles.position === 'absolute';
        if (hudIsAbsolute) {
          containerHeight = Math.max(100, containerHeight - hudHeight - 8);
        }
      }
    }

    // Apply pixel dimensions to backing store
    canvas.width = containerWidth;
    canvas.height = containerHeight;

    // Reflect sizing via style to avoid overflow
    canvas.style.width = containerWidth + 'px';
    canvas.style.height = containerHeight + 'px';

    if (this.trackTrajectory.length > 0) {
      this.drawTrack();
    }
  }

  private setupCanvasEventListeners(): void {
    const canvas = this.canvas.nativeElement;
    
    // Mouse wheel for zoom
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * zoomFactor));
      
      if (newZoom !== this.zoom) {
        // Zoom towards mouse position
        const worldX = (mouseX - this.panX) / this.zoom;
        const worldY = (mouseY - this.panY) / this.zoom;
        
        this.zoom = newZoom;
        
        this.panX = mouseX - worldX * this.zoom;
        this.panY = mouseY - worldY * this.zoom;
        
        // Update locked tooltip position if present
        this.updateLockedTooltipPosition();
        
        this.drawTrack();
      }
    });

    // Mouse down for pan start
    canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      canvas.style.cursor = 'grabbing';
    });

    // Mouse move for pan
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      if (this.isDragging) {
        const deltaX = e.clientX - this.lastMouseX;
        const deltaY = e.clientY - this.lastMouseY;
        
        this.panX += deltaX;
        this.panY += deltaY;
        
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        
        // Update locked tooltip position if present
        this.updateLockedTooltipPosition();
        
        this.drawTrack();
      } else {
        // Check for circle-only hover with debouncing for performance
        this.debouncedHoverCheck(mouseX, mouseY, e.clientX, e.clientY);
      }
    });

    // Click to lock/show tooltip only when clicking driver number circle
    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const clickedDriver = this.findDriverHitAt(mouseX, mouseY);
      if (clickedDriver !== null) {
        // Toggle lock if same driver clicked while locked
        if (this.tooltipLockedDriver === clickedDriver) {
          this.tooltipLockedDriver = null;
          this.hideTooltip(true); // force hide
          return;
        }
        // Lock to new driver and show
        this.tooltipLockedDriver = clickedDriver;
        this.showCarTooltip(clickedDriver, e.clientX, e.clientY, true);
      } else {
        // Click outside unlocks and hides
        if (this.tooltipLockedDriver !== null) {
          this.tooltipLockedDriver = null;
          this.hideTooltip(true);
        }
      }
    });

    // Mouse up for pan end
    canvas.addEventListener('mouseup', () => {
      this.isDragging = false;
      canvas.style.cursor = 'grab';
    });

    // Mouse leave to stop dragging and hide tooltip
    canvas.addEventListener('mouseleave', () => {
      this.isDragging = false;
      canvas.style.cursor = 'default';
      this.hideTooltip();
    });

    // Set initial cursor
    canvas.style.cursor = 'grab';
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.resizeCanvas();
  }

  // Zoom control methods
  public zoomIn(): void {
    const newZoom = Math.min(this.maxZoom, this.zoom * 1.2);
    if (newZoom !== this.zoom) {
      const canvas = this.canvas.nativeElement;
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      const worldX = (centerX - this.panX) / this.zoom;
      const worldY = (centerY - this.panY) / this.zoom;
      
      this.zoom = newZoom;
      
      this.panX = centerX - worldX * this.zoom;
      this.panY = centerY - worldY * this.zoom;
      
      // Update locked tooltip position if present
      this.updateLockedTooltipPosition();
      
      this.drawTrack();
    }
  }

  public zoomOut(): void {
    const newZoom = Math.max(this.minZoom, this.zoom * 0.8);
    if (newZoom !== this.zoom) {
      const canvas = this.canvas.nativeElement;
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      const worldX = (centerX - this.panX) / this.zoom;
      const worldY = (centerY - this.panY) / this.zoom;
      
      this.zoom = newZoom;
      
      this.panX = centerX - worldX * this.zoom;
      this.panY = centerY - worldY * this.zoom;
      
      // Update locked tooltip position if present
      this.updateLockedTooltipPosition();
      
      this.drawTrack();
    }
  }

  public resetZoom(): void {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    
    // Update locked tooltip position if present
    this.updateLockedTooltipPosition();
    
    this.drawTrack();
  }

  private getScaleAndOffset() {
    if (this.trackTrajectory.length === 0) {
        return { scale: 1, offsetX: 0, offsetY: 0 };
    }
    const xCoords = this.trackTrajectory.map(d => d.x);
    const yCoords = this.trackTrajectory.map(d => d.y);

    const minX = Math.min(...xCoords);
    const maxX = Math.max(...xCoords);
    const minY = Math.min(...yCoords);
    const maxY = Math.max(...yCoords);

    const canvasWidth = this.canvas.nativeElement.width;
    const canvasHeight = this.canvas.nativeElement.height;

    const scaleX = canvasWidth / (maxX - minX);
    const scaleY = canvasHeight / (maxY - minY);
    const baseScale = Math.min(scaleX, scaleY) * 0.9;

    // Apply zoom
    const scale = baseScale * this.zoom;

    // Calculate base offset for centering, then apply pan
    const baseOffsetX = (canvasWidth - (maxX - minX) * baseScale) / 2 - minX * baseScale;
    const baseOffsetY = (canvasHeight - (maxY - minY) * baseScale) / 2 - minY * baseScale;
    
    const offsetX = baseOffsetX * this.zoom + this.panX;
    const offsetY = baseOffsetY * this.zoom + this.panY;

    return { scale, offsetX, offsetY };
  }

  drawTrack(): void {
    this.ctx.clearRect(0, 0, this.canvas.nativeElement.width, this.canvas.nativeElement.height);
    if (this.trackTrajectory.length === 0) return;

    const { scale, offsetX, offsetY } = this.getScaleAndOffset();

    this.ctx.beginPath();
    this.ctx.strokeStyle = 'black';
    // Scale line width with zoom (minimum 1px, maximum 6px)
    this.ctx.lineWidth = Math.max(1, Math.min(6, 2 * this.zoom));

    this.trackTrajectory.forEach((p, index) => {
      const x = p.x * scale + offsetX;
      const y = p.y * scale + offsetY;
      if (index === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    });
    this.ctx.stroke();

    // Redraw cars at current time position after drawing track
    this.updateCarsAtCurrentTime();
  }

  drawCar(position: any, driverNumber: number): void {
    const carImage = this.carImages.get(driverNumber);
    if (!carImage) {
      console.log(`❌ Cannot draw car for driver ${driverNumber}: no car image loaded`);
      return;
    }

    const { scale, offsetX, offsetY } = this.getScaleAndOffset();
    const x = position.x * scale + offsetX;
    const y = position.y * scale + offsetY;

    console.log(`🎨 Drawing car ${driverNumber} at canvas position x=${x.toFixed(1)}, y=${y.toFixed(1)} (world: ${position.x}, ${position.y})`);

    // Find the driver to get team color
    const driver = this.drivers.find(d => d.driver_number === driverNumber);
    const teamColor = driver?.car_color || '#E43834';

    // Calculate scaled sizes based on zoom level
    const baseCarSize = 24;
    const baseCircleRadius = 8;
    const baseCircleOffset = 10;
    const baseFontSize = 8;
    
    const carSize = Math.max(12, Math.min(48, baseCarSize * this.zoom));
    const circleRadius = Math.max(4, Math.min(16, baseCircleRadius * this.zoom));
    const circleOffset = Math.max(5, Math.min(20, baseCircleOffset * this.zoom));
    const fontSize = Math.max(6, Math.min(16, baseFontSize * this.zoom));

    // Store car position for hover detection (including both car and driver number circle)
    const circleX = x + circleOffset;
    const circleY = y - circleOffset;
    const detectionRadius = Math.max(circleRadius + 4, 14);
    
    // Store essential position data for backup hover detection
    // Note: Primary hit detection now recalculates positions on-the-fly for zoom accuracy
    this.carPositions.set(driverNumber, { 
      x, 
      y, 
      size: carSize,
      circleX,
      circleY,
      circleRadius: circleRadius,
      detectionRadius
    });

    // Calculate car rotation based on movement direction using time-based approach
    const driverTrajectory = this.trajectories.get(driverNumber);
    let rotation = 0;
    
    if (driverTrajectory && this.currentSimulationTime) {
      // Find previous position to calculate direction
      const currentTime = this.currentSimulationTime.getTime();
      const prevTime = currentTime - 1000; // Look back 1 second
      const prevPosition = this.findPositionAtTime(driverTrajectory, new Date(prevTime));
      
      if (prevPosition && (position.x !== prevPosition.x || position.y !== prevPosition.y)) {
        const deltaX = position.x - prevPosition.x;
        const deltaY = position.y - prevPosition.y;
        rotation = Math.atan2(deltaY, deltaX);
      }
    }

    // Save current context state
    this.ctx.save();
    
    // Translate to car position and rotate
    this.ctx.translate(x, y);
    this.ctx.rotate(rotation);
    
    // Draw the car image (centered at origin after translation) with scaled size
    const halfCarSize = carSize / 2;
    this.ctx.drawImage(carImage, -halfCarSize, -halfCarSize, carSize, carSize);
    
    // Restore context to draw circle and text in normal orientation
    this.ctx.restore();

    // Draw a colored circle for the team instead of the team SVG with scaled size
    this.ctx.beginPath();
  this.ctx.arc(circleX, circleY, circleRadius, 0, 2 * Math.PI);
    this.ctx.fillStyle = teamColor;
    this.ctx.fill();
    this.ctx.strokeStyle = 'white';
    this.ctx.lineWidth = Math.max(1, Math.min(3, 1 * this.zoom));
    this.ctx.stroke();

    // Draw driver number in the circle with scaled font
    this.ctx.fillStyle = 'white';
    this.ctx.font = `bold ${fontSize}px Arial`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(String(driverNumber), circleX, circleY);

    // Debug hover visualization (press 'h' to toggle)
    // if (this.showHoverDebug) {
    //   // Detection radius circle for driver number
    //   this.ctx.beginPath();
    //   this.ctx.strokeStyle = 'rgba(255, 255, 0, 0.6)';
    //   this.ctx.lineWidth = 1;
    //   this.ctx.setLineDash([4, 4]);
    //   this.ctx.arc(circleX, circleY, detectionRadius, 0, 2 * Math.PI);
    //   this.ctx.stroke();
    //   this.ctx.setLineDash([]);

    //   // Car body approximate hover area
    //   this.ctx.beginPath();
    //   this.ctx.strokeStyle = 'rgba(0, 255, 255, 0.35)';
    //   this.ctx.arc(x, y, carSize / 2 + 10, 0, 2 * Math.PI);
    //   this.ctx.stroke();
      
    //   // Cross-hair at car center
    //   this.ctx.beginPath();
    //   this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
    //   this.ctx.lineWidth = 1;
    //   this.ctx.moveTo(x - 5, y);
    //   this.ctx.lineTo(x + 5, y);
    //   this.ctx.moveTo(x, y - 5);
    //   this.ctx.lineTo(x, y + 5);
    //   this.ctx.stroke();
    // }

    // Reset text baseline for other text
    this.ctx.textBaseline = 'alphabetic';
  }

  /**
   * Debounced hover check for better performance during rapid mouse movement
   */
  private debouncedHoverCheck(canvasX: number, canvasY: number, clientX: number, clientY: number): void {
    // Clear existing timeout
    if (this.hoverDebounceTimeout) {
      clearTimeout(this.hoverDebounceTimeout);
    }
    
    // Set new timeout for hover check
    this.hoverDebounceTimeout = window.setTimeout(() => {
      this.handleCarHover(canvasX, canvasY, clientX, clientY);
    }, 16); // ~60fps responsiveness
  }

  /**
   * Handle car hover detection - improved for zoom/pan consistency
   */
  private handleCarHover(canvasX: number, canvasY: number, clientX: number, clientY: number): void {
    // If locked, ignore hover except for updating position when hovering same circle
    if (this.tooltipLockedDriver !== null) {
      const lockedPos = this.carPositions.get(this.tooltipLockedDriver);
      if (lockedPos) {
        // Keep tooltip static when locked (could enhance to follow circle)
      }
      return;
    }
    
    const hoveredDriver = this.findDriverHitAt(canvasX, canvasY);
    const canvas = this.canvas.nativeElement;
    
    if (hoveredDriver !== null) {
      // Change cursor to pointer when hovering over a driver
      canvas.style.cursor = 'pointer';
      this.showCarTooltip(hoveredDriver, clientX, clientY, false);
    } else {
      // Reset cursor to grab when not hovering over a driver
      canvas.style.cursor = this.isDragging ? 'grabbing' : 'grab';
      if (this.showTooltip) {
        this.hideTooltip();
      }
    }
  }

  /**
   * Find which driver's number circle (if any) is at the given canvas coordinates
   * Improved version that recalculates world coordinates on the fly
   */
  private findDriverHitAt(canvasX: number, canvasY: number): number | null {
    if (!this.currentSimulationTime) return null;
    
    let bestDriver: number | null = null;
    let bestMetric = Number.POSITIVE_INFINITY;
    
    // Convert canvas coordinates to world coordinates for accurate hit testing
    const worldX = (canvasX - this.panX) / this.zoom;
    const worldY = (canvasY - this.panY) / this.zoom;
    
    const { scale, offsetX, offsetY } = this.getScaleAndOffset();
    
    for (const driver of this.drivers) {
      const driverNumber = driver.driver_number;
      const driverTrajectory = this.trajectories.get(driverNumber);
      if (!driverTrajectory || driverTrajectory.length === 0) continue;
      
      // Find current position for this driver
      const position = this.findPositionAtTime(driverTrajectory, this.currentSimulationTime);
      if (!position) continue;
      
      // Calculate current screen coordinates for this driver
      const screenX = position.x * scale + offsetX;
      const screenY = position.y * scale + offsetY;
      
      // Calculate scaled sizes based on current zoom level
      const baseCarSize = 24;
      const baseCircleRadius = 8;
      const baseCircleOffset = 10;
      
      const carSize = Math.max(12, Math.min(48, baseCarSize * this.zoom));
      const circleRadius = Math.max(4, Math.min(16, baseCircleRadius * this.zoom));
      const circleOffset = Math.max(5, Math.min(20, baseCircleOffset * this.zoom));
      
      const circleX = screenX + circleOffset;
      const circleY = screenY - circleOffset;
      const detectionRadius = Math.max(circleRadius + 4, 14);
      
      // Check circle hit (driver number)
      const dxC = canvasX - circleX;
      const dyC = canvasY - circleY;
      const circleDistance = Math.sqrt(dxC * dxC + dyC * dyC);
      const circleHit = circleDistance <= detectionRadius;
      
      // Check car body hit
      const dxB = canvasX - screenX;
      const dyB = canvasY - screenY;
      const bodyDistance = Math.sqrt(dxB * dxB + dyB * dyB);
      const bodyRadius = carSize / 2 + 10;
      const bodyHit = bodyDistance <= bodyRadius;
      
      if (circleHit || bodyHit) {
        // Prefer circle proximity (subtract small bias) so number circle chosen when overlapping both
        const metric = circleHit ? circleDistance - 3 : bodyDistance;
        if (metric < bestMetric) {
          bestMetric = metric;
          bestDriver = driverNumber;
        }
      }
    }
    
    return bestDriver;
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent) {
    if (e.key.toLowerCase() === 'h') {
      this.showHoverDebug = !this.showHoverDebug;
      console.log(`🔍 Hover debug ${this.showHoverDebug ? 'enabled' : 'disabled'}`);
      this.drawTrack(); // redraw to add/remove outlines
    }
  }

  /**
   * Show tooltip for a specific driver
   */
  private showCarTooltip(driverNumber: number, clientX: number, clientY: number, locked: boolean = false): void {
    // Get driver information
    const driver = this.drivers.find(d => d.driver_number === driverNumber);
    if (!driver) {
      console.log(`❌ No driver found for driverNumber: ${driverNumber}`);
      return;
    }

    // Get current position data for this driver
    const driverPositionData = this.positionService.getDriverPosition(driverNumber);
    
    // Get car data if available
    const carData = this.currentSimulationTime ? 
      this.openf1ApiService.getDriverCarDataAtTime(driverNumber, this.currentSimulationTime, 5000) : null;

    const tooltipData = {
      driverNumber: driverNumber,
      driverName: `${driver.first_name} ${driver.last_name}`,
      driverAcronym: driver.name_acronym || driver.broadcast_name || `#${driverNumber}`,
      teamColor: driver.car_color || '#888888',
      teamName: driver.team_name || 'Unknown',
      position: driverPositionData?.position || 'N/A',
      carData: carData
    };

    // Debug log the exact tooltip data being displayed
    console.log(`🏎️ Tooltip Data for Driver ${driverNumber}:`, {
      hoveredDriverData: this.hoveredDriverData,
      rawDriverInfo: driver,
      rawPositionData: driverPositionData,
      rawCarData: carData,
      currentSimulationTime: this.currentSimulationTime?.toISOString()
    });

    // Position tooltip near mouse but avoid edges
    const tooltipOffset = 15;
  // If locked, nudge position a bit differently so user can tell it's pinned
    this.ngZone.run(() => {
      this.hoveredDriverData = tooltipData;
      const xOffset = locked ? 25 : tooltipOffset;
      const yOffset = locked ? 120 : 100;
      this.tooltipX = Math.min(clientX + xOffset, window.innerWidth - 220);
      this.tooltipY = Math.max(clientY - yOffset, 10);
      this.showTooltip = true;
      if (locked) {
        console.log(`📌 Locked tooltip for driver ${driverNumber} at (${this.tooltipX}, ${this.tooltipY})`);
      } else {
        console.log(`👆 Hover tooltip for driver ${driverNumber} at (${this.tooltipX}, ${this.tooltipY})`);
      }
      this.cdr.detectChanges();
    });
  }

  /**
   * Hide tooltip
   */
  private hideTooltip(force: boolean = false): void {
    if (this.tooltipLockedDriver !== null && !force) return; // Don't hide if locked unless forced
    this.ngZone.run(() => {
      this.showTooltip = false;
      this.hoveredDriverData = null;
      this.cdr.detectChanges();
    });
  }

  /**
   * Update locked tooltip position when zooming/panning
   */
  private updateLockedTooltipPosition(): void {
    if (this.tooltipLockedDriver === null || !this.showTooltip || !this.currentSimulationTime) {
      return;
    }

    // Find current position of the locked driver
    const driverTrajectory = this.trajectories.get(this.tooltipLockedDriver);
    if (!driverTrajectory || driverTrajectory.length === 0) return;

    const position = this.findPositionAtTime(driverTrajectory, this.currentSimulationTime);
    if (!position) return;

    // Calculate current screen coordinates
    const { scale, offsetX, offsetY } = this.getScaleAndOffset();
    const screenX = position.x * scale + offsetX;
    const screenY = position.y * scale + offsetY;

    // Convert screen coordinates to client coordinates
    const canvas = this.canvas.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const clientX = rect.left + screenX;
    const clientY = rect.top + screenY;

    // Update tooltip position with locked offset
    this.ngZone.run(() => {
      const xOffset = 25; // locked offset
      const yOffset = 120; // locked offset
      this.tooltipX = Math.min(clientX + xOffset, window.innerWidth - 220);
      this.tooltipY = Math.max(clientY - yOffset, 10);
      this.cdr.detectChanges();
    });
  }

  /**
   * Handle race start detection event
   */
  private handleRaceStartDetected(raceInfo: { raceStartTime: Date, isFormationLap: boolean }): void {
    this.raceStartTime = raceInfo.raceStartTime;
    
    // Don't jump to race start time - let the formation lap play naturally
    // Just store the race start time for reference and start the comment sequence
    if (raceInfo.isFormationLap) {
      console.log('🏁 Formation lap detected - race will start naturally with comments');
      console.log(`🏁 Race start time set to: ${raceInfo.raceStartTime.toISOString()}`);
    } else {
      console.log('🏁 Direct race start detected - no formation lap');
    }
  }

  /**
   * Detect race start time and formation lap
   */
  private detectRaceStart(): void {
    this.openf1ApiService.detectRaceStart().subscribe({
      next: (raceInfo) => {
        this.animationControlService.setRaceStartInfo(raceInfo.raceStartTime, raceInfo.isFormationLap);
        this.handleRaceStartDetected(raceInfo);
      },
      error: (error) => {
        console.warn('Could not detect race start:', error);
        // Fallback to session start time
        if (this.sessionStartTime) {
          this.animationControlService.setRaceStartInfo(this.sessionStartTime, false);
        }
      }
    });
  }

  /**
   * Start the race sequence with comments (called when user presses start)
   */
  startRaceSequence(): void {
    // Execute the race start sequence through comments when user starts
    this.raceCommentaryService.executeRaceStartSequence();
    console.log('🏁 Race sequence started with comments - formation lap begins');
  }
}